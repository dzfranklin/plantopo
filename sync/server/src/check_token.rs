use pasetors::{claims::ClaimsValidationRules, local, token::UntrustedToken, version4::V4, Local};

use crate::prelude::*;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub(crate) struct ValidParsedToken {
    map_id: MapId,
    pub(crate) user_id: Option<UserId>,
    pub(crate) client_id: ClientId,
    pub(crate) permit_write: bool,
}

pub(crate) fn check_token(
    secret: &TokenSecret,
    map_id: MapId,
    token: &str,
) -> Result<ValidParsedToken> {
    let token = UntrustedToken::<Local, V4>::try_from(token)?;
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
        .ok_or_else(|| eyre!("Invalid sub claim: {claims:?}"))?;
    let claim_map_id = Uuid::parse_str(claim_map_id)
        .map(MapId)
        .wrap_err("failed to parse sub claim as uuid")?;
    let user_id = claims
        .get_claim("user_id")
        .and_then(|v| v.as_str())
        .map(Uuid::parse_str)
        .transpose()
        .map_err(|_| eyre::eyre!("failed to parse user_id claim as uuid: {claims:?}"))?
        .map(UserId);
    let client_id = claims
        .get_claim("client_id")
        .and_then(|v| v.as_str())
        .and_then(|v| v.parse::<u64>().ok())
        .map(ClientId)
        .ok_or_else(|| eyre!("Invalid client_id claim: {claims:?}"))?;

    if claim_map_id != map_id {
        return Err(eyre!(
            "Sub claim mismatch: claimed {claim_map_id:?} != requested {map_id:?}"
        ));
    }

    Ok(ValidParsedToken {
        map_id,
        user_id,
        client_id,
        permit_write,
    })
}
