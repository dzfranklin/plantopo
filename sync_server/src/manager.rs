use crate::{db::Db, prelude::*};
use lib0::encoding::Write;
use y_sync::{
    awareness::{self, Awareness},
    sync::{Message, MSG_SYNC, MSG_SYNC_UPDATE},
};
use yrs::{
    updates::{
        decoder::Decode,
        encoder::{Encode, Encoder, EncoderV1},
    },
    Update, UpdateEvent, UpdateSubscription,
};
use yrs_warp::ws::{ConnInbox, Inbox};

// Inspired by yrs_warp::BroadcastGroup

const DOC_CHAN_CAP: usize = 1024;

type Sender = broadcast::Sender<Vec<u8>>;
type Subscribers = (UpdateSubscription, UnsoundHack);

pub struct Manager {
    map: Uuid,
    tx: Sender,
    _sub: Subscribers,
}

impl Manager {
    #[instrument(skip(aware))]
    pub fn new(db: Db, map: Uuid, aware: &mut Awareness) -> eyre::Result<Self> {
        let (tx, _) = broadcast::channel(DOC_CHAN_CAP);
        let sub = Self::subscribe_to(map, aware, tx.clone(), db)?;
        Ok(Self { map, tx, _sub: sub })
    }

    #[instrument(skip_all)]
    pub fn join(&self, mut subscriber: ConnInbox) -> JoinHandle<eyre::Result<()>> {
        let mut rx = self.tx.subscribe();
        spawn(async move {
            loop {
                let update = match rx.recv().await {
                    Ok(update) => update,
                    Err(broadcast::error::RecvError::Closed) => break Ok(()),
                    Err(broadcast::error::RecvError::Lagged(n)) => {
                        // At this point the client needs to do a full update
                        // so we disconnect them and expect them to reconnect
                        break Err(eyre!("join: doc_sub lagged by {}", n));
                    }
                };
                subscriber.send(update).await?;
            }
        })
    }

    #[instrument(skip(aware, tx, db))]
    fn subscribe_to(
        map: Uuid,
        aware: &mut Awareness,
        tx: Sender,
        db: Db,
    ) -> eyre::Result<Subscribers> {
        let tx2 = tx.clone();
        let aware_sub =
            aware.on_update(move |aware, event| Self::on_aware_update(map, &tx2, aware, event));
        let aware_sub = UnsoundHack(aware_sub);

        let doc_sub = aware
            .doc()
            .observe_update_v1(move |_tx, event| Self::on_doc_update(map, &db, &tx, event))
            .map_err(|e| eyre!("observe_update_v1: {}", e))?;

        Ok((doc_sub, aware_sub))
    }

    #[instrument(skip(tx, aware, event))]
    fn on_aware_update(map: Uuid, tx: &Sender, aware: &Awareness, event: &awareness::Event) {
        let changed = (event.added().iter())
            .chain(event.updated().iter())
            .chain(event.removed().iter())
            .copied();
        let update = aware
            .update_with_clients(changed)
            .expect("changed clients known");

        let msg = Message::Awareness(update).encode_v1();
        if tx.send(msg).is_err() {
            trace!("report_aware_update: not sent as no receivers")
        }
    }

    #[instrument(skip(db, tx, event))]
    fn on_doc_update(map: Uuid, db: &Db, tx: &Sender, event: &UpdateEvent) {
        trace!("{:?}", Update::decode_v1(&event.update));

        // Equivalant to Message::Sync(SyncMessage::Update(...)).encode_v1()
        // except we avoid an unnecessary Vec clone
        let mut enc = EncoderV1::new();
        enc.write_var(MSG_SYNC);
        enc.write_var(MSG_SYNC_UPDATE);
        enc.write_buf(&event.update);
        let msg = enc.to_vec();
        if tx.send(msg).is_err() {
            trace!("report_aware_update: not sent as no receivers")
        }

        if let Err(err) = db.update_data(map, &event.update) {
            error!("update_data for {map} failed: {err}");
        }
    }
}

impl fmt::Debug for Manager {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Manager")
            .field("map", &self.map)
            .finish_non_exhaustive()
    }
}

struct UnsoundHack(awareness::Subscription<awareness::Event>);
/// # Safety: This isn't
/// But the y libraries do this pervasively, so this isn't making it any worse.
///
/// The real solution is probably to put everything related to a doc on the same
/// thread.
unsafe impl Send for UnsoundHack {}
unsafe impl Sync for UnsoundHack {}
