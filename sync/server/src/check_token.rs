use axum::headers::{authorization::Bearer, Authorization};
use pasetors::{claims::ClaimsValidationRules, local, token::UntrustedToken, version4::V4, Local};

use crate::prelude::*;

pub fn check_token(
    secret: &TokenSecret,
    map_id: MapId,
    token: Authorization<Bearer>,
) -> Result<(UserId, ClientId, bool)> {
    let token = UntrustedToken::<Local, V4>::try_from(token.token())?;
    let token = local::decrypt(secret, &token, &ClaimsValidationRules::new(), None, None)?;
    let claims = token
        .payload_claims()
        .ok_or_else(|| eyre!("missing claims"))?;
    let permit_write = claims
        .get_claim("write")
        .and_then(|v| v.as_bool())
        .ok_or_else(|| eyre!("Invalid write claim: {claims:?}"))?;
    let claim_map_id = claims
        .get_claim("sub")
        .and_then(|v| v.as_str())
        .ok_or_else(|| eyre!("Invlaid sub claim: {claims:?}"))?;
    let claim_map_id = Uuid::parse_str(claim_map_id)
        .map(MapId)
        .wrap_err("failed to parse sub claim as uuid")?;
    let user_id = claims
        .get_claim("user_id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| eyre!("Invalid user_id claim: {claims:?}"))?;
    let user_id = Uuid::parse_str(user_id)
        .map(UserId)
        .map_err(|_| eyre::eyre!("failed to parse user_id claim as uuid: {claims:?}"))?;
    let client_id = claims
        .get_claim("client_id")
        .and_then(|v| v.as_u64())
        .map(|v| ClientId(v))
        .ok_or_else(|| eyre!("Invalid client_id claim: {claims:?}"))?;

    if claim_map_id != map_id {
        return Err(eyre!(
            "Sub claim mismatch: claimed {claim_map_id:?} != requested {map_id:?}"
        ));
    }

    Ok((user_id, client_id, permit_write))
}
