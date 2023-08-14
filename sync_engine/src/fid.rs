use std::fmt;

use eyre::eyre;
use serde::Serialize;

// Max JS safe number is 2^53 - 1
// We'll pack in a 16 bit client ID and 32 bit counter.
// In JS: `client * Math.pow(2, 32) + counter`. Ensure counter < 2^32

/// Feature ID
///
/// Must be creatable by offline clients
#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize)]
pub struct Fid(u64);

impl Fid {
    pub const FEATURE_ROOT: Fid = Fid(0);
    const MAX: u64 = 0xffff_ffffffff;

    pub const fn new(client: u16, counter: u32) -> Fid {
        Fid((client as u64) << 32 | counter as u64)
    }

    /// Validates only if `oid` is greater than [`Self::MAX`].
    pub fn try_new(oid: u64) -> eyre::Result<Self> {
        if oid > Self::MAX {
            return Err(eyre!("OID {} is too large", oid));
        }
        Ok(Self(oid))
    }

    pub fn client(&self) -> u16 {
        (self.0 >> 32) as u16
    }

    pub fn counter(&self) -> u32 {
        (self.0 & 0xffffffff) as u32
    }
}

impl<'de> serde::Deserialize<'de> for Fid {
    fn deserialize<D>(de: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        struct OidVisitor;

        impl<'de> serde::de::Visitor<'de> for OidVisitor {
            type Value = Fid;

            fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
                write!(f, "an oid integer")
            }

            fn visit_u64<E>(self, v: u64) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Fid::try_new(v).map_err(E::custom)
            }
        }

        de.deserialize_u64(OidVisitor)
    }
}

impl fmt::Debug for Fid {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Oid")
            .field("client", &self.client())
            .field("counter", &self.counter())
            .finish()
    }
}

impl fmt::Display for Fid {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{:016x}_{:08x}", self.client(), self.counter())
    }
}
