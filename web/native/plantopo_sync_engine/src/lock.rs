pub use try_lock::Locked;
use try_lock::TryLock;

#[derive(Debug)]
pub struct Lock<T>(TryLock<T>);

impl<T> Lock<T> {
    pub fn new(t: T) -> Self {
        Self(TryLock::new(t))
    }

    pub fn try_lock(&self) -> rustler::NifResult<try_lock::Locked<T>> {
        self.0.try_lock().ok_or_else(|| err!(lock))
    }
}
