use core::ops::Sub;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Instant(u64);

impl Default for Instant {
    fn default() -> Self {
        Self(0)
    }
}

impl Instant {
    #[cfg(feature = "std")]
    pub fn now() -> Self {
        let inner = std::time::SystemTime::now()
            .duration_since(std::time::SystemTime::UNIX_EPOCH)
            .expect("System clock after 1970")
            .as_millis() as u64;
        Self(inner)
    }

    #[cfg(all(feature = "web", not(feature = "std")))]
    pub fn now() -> Self {
        let inner = js_sys::Date::new_0().get_time();

        if inner < 0.0 {
            panic!("System clock before 1970");
        }
        let inner = inner.round() as u64;

        Self(inner)
    }
}

impl Sub<Instant> for Instant {
    type Output = u64;

    fn sub(self, other: Instant) -> u64 {
        self.0 - other.0
    }
}
