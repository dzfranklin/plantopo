use crate::prelude::*;

#[derive(Clone, Copy, Eq, PartialEq, Hash)]
#[cfg_attr(
    feature = "serialize-user-id",
    derive(serde::Deserialize, serde::Serialize)
)]
pub struct UserId(pub Uuid);

impl UserId {
    pub fn into_inner(self) -> Uuid {
        self.0
    }
}

impl fmt::Debug for UserId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "UserId({})", self.0)
    }
}

impl FromStr for UserId {
    type Err = uuid::Error;

    fn from_str(s: &str) -> core::result::Result<Self, Self::Err> {
        Ok(Self(Uuid::from_str(s)?))
    }
}

impl From<Uuid> for UserId {
    fn from(value: Uuid) -> Self {
        Self(value)
    }
}

impl From<UserId> for Uuid {
    fn from(value: UserId) -> Self {
        value.into_inner()
    }
}
