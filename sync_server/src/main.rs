use eyre::Result;
use tracing_subscriber::{prelude::*, EnvFilter};

use plantopo_sync_server::Dispatcher;

#[tokio::main]
async fn main() -> Result<()> {
    color_eyre::install()?;
    tracing_subscriber::registry()
        .with(tracing_error::ErrorLayer::default())
        // .with(console_subscriber::spawn())
        .with(tracing_subscriber::fmt::layer().pretty())
        .with(EnvFilter::from_default_env())
        .init();

    let dispatcher = Dispatcher::new();

    let _ = tokio::signal::ctrl_c().await;
    tracing::info!("Starting shutdown");
    dispatcher.shutdown().await;
    tracing::info!("Shutdown complete");

    todo!()
}
