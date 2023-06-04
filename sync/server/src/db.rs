use std::{env, time::Duration};

use plantopo_sync_core::{ClientId, MapId};
use sqlx::{
    postgres::{PgConnectOptions, PgPoolOptions},
    ConnectOptions,
};
use tracing::log::LevelFilter;

use crate::prelude::*;

pub type Pool = sqlx::Pool<sqlx::Postgres>;

pub async fn setup() -> Result<Pool> {
    let mut db_opts: PgConnectOptions = env::var("DATABASE_URL")?.parse()?;
    db_opts.log_statements(LevelFilter::Debug);
    db_opts.log_slow_statements(LevelFilter::Debug, Duration::from_millis(100));
    let db: Pool = PgPoolOptions::new()
        .max_connections(20)
        .connect_with(db_opts)
        .await?;
    Ok(db)
}

pub async fn next_client_id(db: &Pool, server: ClientId, map: MapId) -> Result<ClientId> {
    // TODO: Use snowflake instead
    let server = server.into_inner();
    assert!(server <= u8::MAX as u64);

    let record = sqlx::query!(
        "
INSERT INTO next_client_id (map_id, server_id, next_suffix)
VALUES ($1, $2, $3)
ON CONFLICT (map_id, server_id)
  DO UPDATE SET next_suffix = next_client_id.next_suffix + 1
RETURNING next_suffix
      ",
        map.into_inner(),
        server as i32,
        i64::MIN,
    )
    .fetch_one(db)
    .await?;

    // Shift the range from [-2^63, 2^63) to [0, 2^64)
    let suffix = (record.next_suffix as i128 - i64::MIN as i128) as u64;

    assert!(suffix < 2_u64.pow(56));
    let value = server << 56 | suffix;

    Ok(ClientId(value))
}

pub async fn save_client(db: &Pool, map: MapId, server: ClientId, save: &[u8]) -> Result<()> {
    let saved_at = Utc::now();

    let strat = ExponentialBackoff::from_millis(10)
        .max_delay(Duration::from_secs(5))
        .map(jitter)
        .take(10);

    Retry::spawn(strat, || async {
        sqlx::query!(
            "
INSERT INTO map_saves (map_id, server_id, client, saved_at)
VALUES ($1, $2, $3, $4)
ON CONFLICT (map_id, server_id)
DO UPDATE SET client = $3, saved_at = $4
            ",
            map.into_inner(),
            server.into_inner() as i32,
            save,
            saved_at.naive_utc(),
        )
        .execute(db)
        .await?;

        tracing::debug!(?map, ?saved_at, bytes = save.len(), "Saved client");

        Ok::<_, eyre::Report>(())
    })
    .await?;

    Ok(())
}

pub async fn load_client(db: &Pool, map: MapId, server: ClientId) -> Result<Option<Vec<u8>>> {
    let strat = ExponentialBackoff::from_millis(10).map(jitter).take(3);

    Retry::spawn(strat, || async {
        let record = sqlx::query!(
            "SELECT client, saved_at FROM map_saves WHERE map_id = $1 AND server_id = $2",
            map.into_inner(),
            server.into_inner() as i32,
        )
        .fetch_optional(db)
        .await?;

        if let Some(record) = record {
            tracing::info!(
                at = ?record.saved_at,
                bytes = record.client.len(),
                "Loaded map from save"
            );
            Ok(Some(record.client))
        } else {
            Ok(None)
        }
    })
    .await
}
