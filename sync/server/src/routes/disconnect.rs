use crate::Disconnect;

use super::prelude::*;

#[derive(Debug, Deserialize)]
pub struct Req {
    map_id: Uuid,
    user_id: Option<UserId>,
}

#[instrument(skip(authorizer_token, state))]
pub async fn post(
    TypedHeader(authorizer_token): TypedHeader<Authorization<Bearer>>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    State(state): State<Arc<AppState>>,
    Json(payload): Json<Req>,
) -> impl IntoResponse {
    if authorizer_token.token() != state.server_secret {
        tracing::info!("Authorizer token mismatch)");
        return StatusCode::UNAUTHORIZED;
    }

    let map_id = MapId(payload.map_id);

    let map_state = match state.maps.lock().get(&map_id).cloned() {
        Some(map_state) => map_state,
        None => {
            tracing::info!("No need to disconnect as map not in state: {map_id:?}");
            return StatusCode::OK;
        }
    };

    let disconnect = if let Some(user_id) = payload.user_id {
        Disconnect::User(user_id)
    } else {
        Disconnect::All
    };

    tracing::info!("Sending disconnect from {map_id:?}: {disconnect:?}");
    let _ = map_state.disconnect.send(disconnect);

    StatusCode::OK
}
