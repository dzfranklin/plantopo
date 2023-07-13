use std::{
    fmt, ops,
    time::{SystemTime, UNIX_EPOCH},
};

use uuid::Uuid;

use crate::core_capnp;

#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub struct LngLat {
    pub lng: f64,
    pub lat: f64,
}

impl From<core_capnp::lng_lat::Reader<'_>> for LngLat {
    fn from(r: core_capnp::lng_lat::Reader<'_>) -> Self {
        Self {
            lng: r.get_lng(),
            lat: r.get_lat(),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct FeatureId(LInstant);

impl FeatureId {
    pub fn new(value: u64) -> Result<Self, OutOfBoundsError> {
        LInstant::try_from(value).map(Self)
    }

    pub fn inner(self) -> u64 {
        self.0.inner()
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct LayerId(pub Uuid);

impl LayerId {
    pub fn inner(self) -> Uuid {
        self.0
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default)]
pub struct ClientId(u32);

impl ClientId {
    const MAX: u32 = 2_u32.pow(26) - 1;

    pub fn new(id: u32) -> Result<Self, OutOfBoundsError> {
        if id > Self::MAX {
            return Err(OutOfBoundsError);
        }
        Ok(ClientId(id))
    }

    pub fn inner(self) -> u32 {
        self.0
    }
}

#[derive(Default, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct LInstant(u64);

impl LInstant {
    const OFFSET: u64 = 26;
    const MAX_COUNTER: u32 = 2_u32.pow(27) - 1;
    const MAX_VALUE: u64 = 2_u64.pow(52) - 1;

    pub fn new(client: ClientId, counter: u32) -> Result<LInstant, OutOfBoundsError> {
        if counter > Self::MAX_COUNTER {
            Err(OutOfBoundsError)
        } else {
            Ok(Self((client.0 as u64) << Self::OFFSET | counter as u64))
        }
    }

    pub fn client(self) -> ClientId {
        ClientId((self.0 - self.0 >> Self::OFFSET) as u32)
    }

    pub fn counter(self) -> u32 {
        (self.0 >> Self::OFFSET) as u32
    }

    pub fn inner(self) -> u64 {
        self.0
    }
}

impl TryFrom<u64> for LInstant {
    type Error = OutOfBoundsError;

    fn try_from(value: u64) -> Result<Self, Self::Error> {
        let value = value;
        if value > LInstant::MAX_VALUE {
            Err(OutOfBoundsError)
        } else {
            Ok(LInstant(value))
        }
    }
}

impl fmt::Debug for LInstant {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("LInstant")
            .field("client", &self.client())
            .field("counter", &self.counter())
            .finish()
    }
}

#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct PInstant(pub u64);

impl PInstant {
    pub fn now() -> Self {
        let inner: u64 = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock after epoch")
            .as_millis()
            .try_into()
            .expect("duration since epoch fits in u64");
        Self(inner)
    }

    pub fn inner(self) -> u64 {
        self.0
    }
}

pub trait UuidReaderExt {
    fn as_uuid(&self) -> Uuid;
}

impl UuidReaderExt for core_capnp::uuid::Reader<'_> {
    fn as_uuid(&self) -> Uuid {
        let d4 = self.get_d4().to_le_bytes();
        Uuid::from_fields_le(self.get_d1(), self.get_d2(), self.get_d3(), &d4)
    }
}

pub trait UuidBuilderExt {
    fn set_uuid(&mut self, uuid: Uuid);
}

impl UuidBuilderExt for core_capnp::uuid::Builder<'_> {
    fn set_uuid(&mut self, uuid: Uuid) {
        let (d1, d2, d3, d4) = uuid.to_fields_le();
        self.set_d1(d1);
        self.set_d2(d2);
        self.set_d3(d3);
        self.set_d4(u64::from_le_bytes(*d4));
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct OutOfBoundsError;

impl std::error::Error for OutOfBoundsError {}

impl fmt::Display for OutOfBoundsError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "out of bounds error")
    }
}
