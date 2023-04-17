use crate::prelude::*;

#[derive(Debug)]
pub struct MapState {
    pub id: MapId,
    pub client: Mutex<Client>,
    pub connected: Mutex<HashSet<ClientId>>,
    pub broadcast: broadcast::Sender<(ClientId, Bytes)>,
    pub disconnect: broadcast::Sender<Disconnect>,
}

#[derive(Debug, Clone)]
pub enum Disconnect {
    All,
    User(UserId),
}

pub type MapStates = Mutex<HashMap<MapId, Arc<MapState>>>;
