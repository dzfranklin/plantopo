use tokio::sync::mpsc;
use tokio_util::sync::CancellationToken;

pub fn new() -> (Observer, Controller) {
    let (tx, rx) = mpsc::channel(1);
    let token = CancellationToken::new();
    (
        Observer {
            inhibiter: tx,
            token: token.clone(),
        },
        Controller {
            inhibiter: rx,
            token,
        },
    )
}

#[derive(Debug, Clone)]
pub struct Observer {
    inhibiter: mpsc::Sender<()>,
    token: CancellationToken,
}

#[derive(Debug)]
pub struct Inhibiter(mpsc::Sender<()>);

#[derive(Debug)]
pub struct Controller {
    inhibiter: mpsc::Receiver<()>,
    token: CancellationToken,
}

impl Observer {
    pub fn inhibit(&self) -> Inhibiter {
        Inhibiter(self.inhibiter.clone())
    }

    /// Returns a future that resolves whe we should start shutting down.
    ///
    /// This future will complete immediately if shutdown has already begun.
    ///
    /// # Cancel safety
    /// This method is cancel safe.
    pub async fn recv(&self) {
        self.token.cancelled().await;
    }

    pub fn in_progress(&self) -> bool {
        self.token.is_cancelled()
    }
}

impl Controller {
    pub async fn shutdown(mut self) {
        self.token.cancel();

        // When all inhibit guards are dropped recv will error
        let _ = self.inhibiter.recv().await;
    }
}
