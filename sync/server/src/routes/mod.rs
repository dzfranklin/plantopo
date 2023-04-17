mod authorize;
mod debug;
mod disconnect;
mod map_ws;
mod prelude;

use prelude::*;
use tower_http::catch_panic::CatchPanicLayer;

pub fn router(app_state: Arc<AppState>) -> Router {
    Router::new()
        .route("/debug", get(debug::get))
        .route("/debug/:id", get(debug::get_map))
        .route("/authorize", post(authorize::post))
        .route("/disconnect", post(disconnect::post))
        .route("/ws/:id", get(map_ws::upgrade))
        .layer(CatchPanicLayer::new())
        .with_state(app_state)
}
