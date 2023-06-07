use crate::{prelude::*, workers};

pub struct AppState {
    pub id: ClientId,
    pub map_workers: Mutex<HashMap<MapId, workers::map_sync::Handle>>,
    pub token_secret: TokenSecret,
    pub server_secret: String,
    pub db: db::Pool,
    pub shutdown: shutdown::Observer,
}

impl fmt::Debug for AppState {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("AppState")
            .field("id", &self.id)
            .field("map_workers", &self.map_workers)
            .field("db", &self.db)
            .finish_non_exhaustive()
    }
}
