#![feature(never_type)]

use std::{env, net::SocketAddr, str::FromStr, sync::Arc};

use axum::http::{HeaderMap, Request, Response};
use eyre::{Result, WrapErr};
use parking_lot::Mutex;
use pasetors::{
    keys::{Generate, SymmetricKey},
    version4::V4,
};
use tokio::signal;
use tower_http::{
    catch_panic::CatchPanicLayer, classify::ServerErrorsFailureClass, trace::TraceLayer,
};
use tracing::Span;
use tracing_subscriber::{prelude::*, EnvFilter};

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
        .with(tracing_error::ErrorLayer::default())
        .with(console_subscriber::spawn())
        .with(tracing_subscriber::fmt::layer().pretty())
        .with(EnvFilter::from_default_env())
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
        map_workers: Mutex::default(),
        token_secret,
        server_secret,
        shutdown: shutdown_observer,
        db,
    });
    assert!(app_state.id.0 > 0, "reserved");
    assert!(app_state.id.0 <= u8::MAX as u64);

    let service = router(app_state)
        .layer(CatchPanicLayer::new())
        .layer(
            TraceLayer::new_for_http()
                .make_span_with(|_: &Request<_>| tracing::debug_span!("http"))
                .on_request(|request: &Request<_>, _span: &Span| {
                    tracing::info!(
                        method=%request.method(),
                        path=%request.uri().path(),
                        "request"
                    )
                })
                .on_response(|_: &Response<_>, latency, _span: &Span| {
                    tracing::info!(?latency, "response")
                })
                .on_body_chunk(|chunk: &axum::body::Bytes, latency, _span: &Span| {
                    tracing::debug!(bytes = chunk.len(), ?latency, "body_chunk")
                })
                .on_eos(
                    |_: Option<&HeaderMap>, stream_duration, _span: &Span| {
                        tracing::debug!(?stream_duration, "eos")
                    },
                )
                .on_failure(|error: ServerErrorsFailureClass, latency, _span: &Span| {
                    tracing::warn!(%error, ?latency, "failure")
                }),
        )
        .into_make_service_with_connect_info::<SocketAddr>();

    tracing::info!(%addr, "Listening");

    axum::Server::bind(&addr)
        .serve(service)
        .with_graceful_shutdown(async move {
            let _ = signal::ctrl_c().await;
            tracing::info!("Starting shutdown");
        })
        .await?;

    tracing::info!("Waiting for shutdown to complete");
    shutdown_controller.shutdown().await;
    tracing::info!("Shutdown complete");

    Ok(())
}
