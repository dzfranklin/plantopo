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
