use crate::{
    aware_capnp,
    capnp_support::{read_l_instant, read_uuid, write_l_instant, write_uuid},
    prelude::*,
    sync_capnp,
};

const EXPIRY_MILLIS: u64 = 30_000; // yjs uses 30s

#[derive(Debug)]
pub struct Store {
    me: ClientId,
    entries: HashMap<ClientId, (Instant, Aware)>,
    dirty: bool,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Aware {
    pub is_server: bool,
    pub user: Option<UserId>,
    pub active_features: SmallVec<[feature::Id; 1]>,
}

impl Store {
    pub(crate) fn new(me: ClientId) -> Self {
        let mut entries = HashMap::new();
        entries.insert(me, (Instant::now(), Aware::default()));
        Self {
            me,
            entries,
            dirty: false,
        }
    }

    /// Dirty is initially true and is set to true whenever the value held may
    /// have changed.
    pub fn is_dirty(&self) -> bool {
        self.dirty
    }

    pub fn clear_dirty(&mut self) {
        self.dirty = false;
    }

    pub fn get(&self, client: ClientId) -> Option<&Aware> {
        self.entries.get(&client).map(|(_, entry)| entry)
    }

    pub fn get_my(&self) -> &Aware {
        self.entries
            .get(&self.me)
            .map(|(_, entry)| entry)
            .expect("entries has me")
    }

    #[tracing::instrument(skip_all)]
    pub fn merge(&mut self, delta: &[(ClientId, Option<Aware>)]) {
        let now = Instant::now();

        if !delta.is_empty() {
            self.dirty = true;
        }

        for (client, entry) in delta {
            if let Some(entry) = entry {
                self.entries.insert(*client, (now, entry.clone()));
            } else {
                if *client == self.me {
                    tracing::warn!("Ignoring aware entry to disconnect ourselves");
                } else {
                    self.entries.remove(client);
                }
            }
        }

        self.entries
            .retain(|client, entry| *client == self.me || not_expired(&entry, now));
    }

    #[tracing::instrument(skip_all)]
    pub(crate) fn save(&self, out: &mut Delta) {
        out.aware.reserve(self.entries.len());
        for (client, aware) in self.iter() {
            out.aware.push((client, Some(aware.clone())));
        }
    }

    pub fn iter(&self) -> Iter {
        Iter {
            store: self,
            inner: self.entries.iter(),
            now_for_expiry: Instant::now(),
        }
    }
}

fn not_expired((value, _): &(Instant, Aware), now: Instant) -> bool {
    now - *value < EXPIRY_MILLIS
}

pub struct Iter<'a> {
    store: &'a Store,
    inner: hash_map::Iter<'a, ClientId, (Instant, Aware)>,
    now_for_expiry: Instant,
}

impl Iter<'_> {
    pub fn max_len(&self) -> usize {
        self.inner.len()
    }
}

impl<'a> Iterator for Iter<'a> {
    type Item = (ClientId, &'a Aware);

    fn size_hint(&self) -> (usize, Option<usize>) {
        (0, Some(self.max_len()))
    }

    fn next(&mut self) -> Option<Self::Item> {
        while let Some((client, v)) = self.inner.next() {
            if *client == self.store.me || not_expired(v, self.now_for_expiry) {
                return Some((*client, &v.1));
            }
        }
        None
    }
}

pub fn read_entry(r: aware_capnp::entry::Reader) -> Result<(ClientId, Option<Aware>)> {
    let client = ClientId(r.get_client());

    if r.get_disconnect() {
        return Ok((client, None));
    }

    let mut entry = Aware::default();

    {
        let r = r.get_active_features()?;
        let mut value = SmallVec::with_capacity(r.len() as usize);
        for f in r.iter() {
            let id = read_l_instant(f);
            value.push(id.into());
        }
        entry.active_features = value;
    }

    if r.has_user() {
        let id = read_uuid(r.get_user()?);
        entry.user = Some(id.into());
    }
    entry.is_server = r.get_is_server();

    Ok((client, Some(entry)))
}
