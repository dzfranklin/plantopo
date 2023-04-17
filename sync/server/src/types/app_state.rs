use crate::prelude::*;

pub struct AppState {
    pub id: ClientId,
    pub maps: MapStates,
    pub token_secret: TokenSecret,
    pub server_secret: String,
    pub db: db::Pool,
    pub shutdown: shutdown::Observer,
}

impl fmt::Debug for AppState {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("AppState")
            .field("id", &self.id)
            .field("db", &self.db)
            .finish_non_exhaustive()
    }
}
