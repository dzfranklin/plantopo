use pasetors::claims::Claims;

use super::prelude::*;

#[derive(Debug, Deserialize)]
pub struct Req {
    user_id: Uuid,
    map_id: Uuid,
    client_id: Option<u64>,
    write: bool,
}

#[derive(Debug, Serialize)]
pub struct Resp {
    token: String,
    client_id: u64,
    exp: String,
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
        return Err(StatusCode::UNAUTHORIZED);
    }

    // TODO: Check if the map exists?

    let iat = Utc::now();
    let exp = (iat + chrono::Duration::minutes(10)).to_rfc3339();
    let user_id = payload.user_id.to_string();
    let map_id = MapId(payload.map_id);
    let client_id = if let Some(client_id) = payload.client_id {
        ClientId(client_id)
    } else {
        db::next_client_id(&state.db, state.id, map_id)
            .await
            .map_err(|err| {
                tracing::error!("Failed to get next client id: {err})");
                StatusCode::INTERNAL_SERVER_ERROR
            })?
    };

    let mut claims = Claims::new().unwrap();
    claims.subject(&map_id.into_inner().to_string()).unwrap();
    claims.issued_at(&iat.to_rfc3339()).unwrap();
    claims.expiration(&exp).unwrap();
    claims.add_additional("user_id", user_id).unwrap();
    claims.add_additional("client_id", client_id.0).unwrap();
    claims.add_additional("write", payload.write).unwrap();

    let token = pasetors::local::encrypt(&state.token_secret, &claims, None, None).unwrap();

    tracing::info!("Issued token {claims:?})");

    Ok(Json(Resp {
        token,
        client_id: client_id.into_inner(),
        exp,
    }))
}
