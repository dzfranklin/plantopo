use crate::prelude::*;

#[derive(Debug)]
pub struct Error {
    description: Cow<'static, str>,
    source: Option<Source>,
}

#[derive(Debug)]
enum Source {
    Crate(Box<Error>),
    Capnp(Box<capnp::Error>),
}

#[cfg(feature = "std")]
impl std::error::Error for Error {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self.source {
            Some(ref e) => match e {
                Source::Crate(ref e) => Some(e.as_ref()),
                Source::Capnp(ref e) => Some(e.as_ref()),
            },
            None => None,
        }
    }
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        if let Some(source) = &self.source {
            write!(f, "core error: {}: {}", self.description, source)
        } else {
            write!(f, "core error: {}", self.description)
        }
    }
}

impl fmt::Display for Source {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Source::Crate(v) => fmt::Display::fmt(v, f),
            Source::Capnp(v) => fmt::Display::fmt(v, f),
        }
    }
}

impl From<capnp::Error> for Error {
    fn from(e: capnp::Error) -> Self {
        tracing::trace!("Error::from({e})");
        Self {
            description: "capnp".into(),
            source: Some(Source::Capnp(Box::new(e))),
        }
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

pub(crate) trait WrapErr<T> {
    fn wrap_err(self, s: impl Into<Cow<'static, str>>) -> Result<T>
    where
        Self: Sized;
}

impl<T> WrapErr<T> for Result<T> {
    fn wrap_err(self, s: impl Into<Cow<'static, str>>) -> Result<T>
    where
        Self: Sized,
    {
        self.map_err(|e| {
            let description = s.into();
            tracing::trace!(?e, ?description, "WrapErr::wrap_err");
            Error {
                description,
                source: Some(Source::Crate(Box::new(e))),
            }
        })
    }
}
