use std::fmt;

use rand::Rng;
use serde::{de::Visitor, Deserialize, Serialize, Serializer};

#[derive(Clone, Hash, PartialEq, Eq, PartialOrd, Ord, Default)]
pub struct FracIdx(Vec<u8>);

impl FracIdx {
    /// **Panics** if invalid
    pub fn new(v: impl Into<Vec<u8>>) -> Self {
        v.into().try_into().unwrap()
    }

    pub fn as_str(&self) -> &str {
        std::str::from_utf8(&self.0).unwrap()
    }
}

const MIN_DIGIT: u8 = b' ';
const MAX_DIGIT: u8 = b'~';
const MAX_JITTER: u16 = 0x10;

pub fn between(rng: &mut impl Rng, before: Option<&FracIdx>, after: Option<&FracIdx>) -> FracIdx {
    let empty = FracIdx::default();
    let before = &before.unwrap_or(&empty).0;
    let after = &after.unwrap_or(&empty).0;

    let mut found_difference = false;
    let mut result = Vec::new();
    let mut i = 0;

    loop {
        let digit_before = *before.get(i).unwrap_or(&MIN_DIGIT);
        let digit_after = if !found_difference && i < after.len() {
            after[i]
        } else {
            MAX_DIGIT + 1
        };
        let pick = ((digit_before as u16 + digit_after as u16) >> 1_u16) as u8;
        result.push(pick);

        if pick <= digit_before {
            if digit_before < digit_after {
                found_difference = true;
            }

            i += 1;
            continue;
        }

        let mut jitter = rng.gen_range(0..MAX_JITTER);
        while jitter > 0 {
            let base = u8::MAX as u16;
            let modulo = jitter % base;
            jitter = (jitter - modulo) / base;
            result.push(MIN_DIGIT + modulo as u8);
        }

        return FracIdx::try_from(result).unwrap();
    }
}

impl TryFrom<Vec<u8>> for FracIdx {
    type Error = NotInAlphabetError;

    fn try_from(value: Vec<u8>) -> Result<Self, Self::Error> {
        for char in &value {
            if !(MIN_DIGIT..=MAX_DIGIT).contains(char) {
                return Err(NotInAlphabetError(*char));
            }
        }
        Ok(Self(value))
    }
}

#[derive(Clone, PartialEq, Eq, Debug)]
pub struct NotInAlphabetError(u8);

impl std::error::Error for NotInAlphabetError {}

impl fmt::Display for NotInAlphabetError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "A character is not in the valid alphabet for a FracIdx. Got: {}",
            self.0
        )
    }
}

impl<'de> Deserialize<'de> for FracIdx {
    fn deserialize<D>(de: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        struct FracIdxVisitor;

        impl<'de> Visitor<'de> for FracIdxVisitor {
            type Value = FracIdx;

            fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
                f.write_str("string")
            }

            fn visit_str<E>(self, v: &str) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                self.visit_string(v.to_string())
            }

            fn visit_string<E>(self, v: String) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                FracIdx::try_from(Vec::from(v)).map_err(|e| E::custom(e.to_string()))
            }
        }
        de.deserialize_string(FracIdxVisitor)
    }
}

impl Serialize for FracIdx {
    fn serialize<S>(&self, ser: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        ser.serialize_str(self.as_str())
    }
}

impl fmt::Display for FracIdx {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        for char in self.0.iter() {
            assert!(char.is_ascii());
            write!(f, "{}", *char as char)?;
        }
        Ok(())
    }
}

impl fmt::Debug for FracIdx {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "FracIdx({self})")
    }
}

#[cfg(test)]
mod tests {
    #[allow(unused_imports)]
    use pretty_assertions::{assert_eq, assert_ne};
    use rand::{rngs::SmallRng, SeedableRng};

    use crate::test_init;

    use super::*;

    fn check_between(pair: (Option<FracIdx>, Option<FracIdx>), expected: FracIdx) {
        test_init();
        let mut rng = SmallRng::from_seed([
            215, 111, 135, 233, 145, 80, 167, 174, 104, 252, 183, 103, 102, 38, 220, 208, 86, 111,
            111, 152, 150, 10, 0, 233, 160, 87, 250, 16, 164, 119, 208, 161,
        ]);
        let actual = between(&mut rng, pair.0.as_ref(), pair.1.as_ref());
        assert_eq!(expected, actual);
    }

    #[test]
    fn between_nothing() {
        check_between((None, None), FracIdx::new("O,"))
    }
}
