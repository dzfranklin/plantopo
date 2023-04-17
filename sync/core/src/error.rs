use crate::prelude::*;

#[derive(Debug, Clone, PartialEq, PartialOrd)]
pub struct Error {
    description: Cow<'static, str>,
    source: Option<Box<Error>>,
}

impl Error {
    pub fn new(s: impl Into<Cow<'static, str>>) -> Self {
        let description = s.into();
        tracing::trace!("Error::new({description})");
        Self {
            description,
            source: None,
        }
    }

    pub fn with_source(mut self, cause: Error) -> Self {
        tracing::trace!("Error::with_source({self}, {cause})");
        self.source = Some(Box::new(cause));
        self
    }
}

impl core::error::Error for Error {
    fn source(&self) -> Option<&(dyn core::error::Error + 'static)> {
        match self.source {
            Some(ref e) => Some(e),
            None => None,
        }
    }
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "core error: {}", self.description)
    }
}

impl From<capnp::Error> for Error {
    fn from(e: capnp::Error) -> Self {
        tracing::trace!("Error::from({e})");
        Self::new("capnp").with_source(Error::new(e.to_string()))
    }
}

impl From<&'static str> for Error {
    fn from(e: &'static str) -> Self {
        tracing::trace!("Error::from({e})");
        Self {
            description: e.into(),
            source: None,
        }
    }
}

pub trait WrapErr {
    fn wrap_err(self, s: impl Into<Cow<'static, str>>) -> Self
    where
        Self: Sized;
}

impl<T> WrapErr for Result<T> {
    fn wrap_err(self, s: impl Into<Cow<'static, str>>) -> Self
    where
        Self: Sized,
    {
        self.map_err(|e| {
            let description = s.into();
            tracing::trace!(?e, ?description, "WrapErr::wrap_err");
            Error {
                description,
                source: Some(Box::new(e)),
            }
        })
    }
}
