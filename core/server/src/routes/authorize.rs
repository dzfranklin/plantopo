use pasetors::claims::Claims;

use super::prelude::*;

#[derive(Debug, Deserialize)]
pub struct Req {
    user_id: Option<Uuid>,
    map_id: Uuid,
    client_id: Option<u64>,
    write: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Resp {
    token: String,
    user_id: Option<Uuid>,
    map_id: Uuid,
    client_id: String,
    write: bool,
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
    let map_id = MapId(payload.map_id);
    let client_id = if let Some(client_id) = payload.client_id {
        ClientId(client_id)
    } else {
        db::next_client_id(&state.db, state.id, map_id)
            .await
            .map_err(|error| {
                tracing::error!(%error, "Failed to get next client id");
                StatusCode::INTERNAL_SERVER_ERROR
            })?
    };
    // We convert client_id to a string because JSON can't reliably round-trip u64s
    let client_id = client_id.into_inner().to_string();

    let mut claims = Claims::new().unwrap();
    claims.subject(&map_id.into_inner().to_string()).unwrap();
    claims.issued_at(&iat.to_rfc3339()).unwrap();
    claims.expiration(&exp).unwrap();
    if let Some(user_id) = payload.user_id {
        claims
            .add_additional("user_id", user_id.to_string())
            .unwrap();
    }
    claims
        .add_additional("client_id", client_id.clone())
        .unwrap();
    claims.add_additional("write", payload.write).unwrap();

    let token = pasetors::local::encrypt(&state.token_secret, &claims, None, None).unwrap();

    tracing::info!(?claims, "Issued token");

    Ok(Json(Resp {
        token,
        user_id: payload.user_id,
        client_id,
        map_id: map_id.into_inner(),
        write: payload.write,
        exp,
    }))
}
