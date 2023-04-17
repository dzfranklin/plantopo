#![feature(never_type)]

use std::{env, net::SocketAddr, str::FromStr, sync::Arc};

use eyre::{Result, WrapErr};
use parking_lot::Mutex;
use pasetors::{
    keys::{Generate, SymmetricKey},
    version4::V4,
};
use tokio::signal;
use tracing_subscriber::prelude::*;

use plantopo_sync_core as sync_core;
use sync_core::ClientId;

use plantopo_sync_server as sync_server;
use sync_server::{db, routes::router, shutdown, AppState};

const DEFAULT_ADDR: &str = "127.0.0.1:4004";

#[tokio::main]
async fn main() -> Result<()> {
    dotenvy::dotenv()?;
    color_eyre::install()?;
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "plantopo_sync_server=info,plantopo_sync_core=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let addr = env::var("PLANTOPO_SYNC_SERVER_ADDR").unwrap_or_else(|_| DEFAULT_ADDR.to_string());
    let addr = SocketAddr::from_str(&addr)?;

    let token_secret = SymmetricKey::<V4>::generate()?;
    let server_secret = env::var("PLANTOPO_SYNC_SERVER_SECRET")
        .wrap_err("PLANTOPO_SYNC_SERVER_SECRET must be set")?;

    let db = db::setup().await?;
    let (shutdown_observer, shutdown_controller) = shutdown::new();

    let app_state = Arc::new(AppState {
        id: ClientId(0x01),
        maps: Mutex::default(),
        token_secret,
        server_secret,
        shutdown: shutdown_observer,
        db,
    });
    assert!(app_state.id.0 > 0, "reserved");
    assert!(app_state.id.0 <= u8::MAX as u64);

    tracing::info!("Listening on {}", addr);

    axum::Server::bind(&addr)
        .serve(router(app_state.clone()).into_make_service_with_connect_info::<SocketAddr>())
        .with_graceful_shutdown(async move {
            let _ = signal::ctrl_c().await;
            tracing::info!("Received SIGINT, starting shutdown");
            app_state.maps.lock().clear();
        })
        .await?;

    tracing::info!("Waiting for shutdown to complete");
    shutdown_controller.shutdown().await;
    tracing::info!("Shutdown complete");

    Ok(())
}
