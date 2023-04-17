use super::prelude::*;

pub async fn get(
    TypedHeader(token): TypedHeader<Authorization<Bearer>>,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    if token.token() != state.server_secret {
        return Err(StatusCode::UNAUTHORIZED);
    }
    Ok(format!("{:#?}\n", state))
}

pub async fn get_map(
    TypedHeader(token): TypedHeader<Authorization<Bearer>>,
    Path(map_id): Path<Uuid>,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    if token.token() != state.server_secret {
        return Err(StatusCode::UNAUTHORIZED);
    }
    let map_id = MapId(map_id);
    let maps = state.maps.lock();
    let map_state = maps.get(&map_id);
    Ok(format!("{:#?}\n", map_state))
}
