mod authorize;
mod debug;
mod map_ws;
mod prelude;

use prelude::*;

pub fn router(app_state: Arc<AppState>) -> Router {
    Router::new()
        .route("/debug", get(debug::get))
        .route("/authorize", post(authorize::post))
        .route("/ws/:id", get(map_ws::upgrade))
        .with_state(app_state)
}
