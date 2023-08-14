use std::fmt;

use ascii::{AsciiChar, AsciiString};
use serde::{de::Visitor, Deserialize, Serialize};

#[derive(Clone, PartialEq, Eq, PartialOrd, Ord, Debug, Default, Serialize)]
pub struct FracIdx(AsciiString);

const MIN_DIGIT: u8 = b' ';
const MAX_DIGIT: u8 = b'~';

pub fn between(before: Option<&FracIdx>, after: Option<&FracIdx>) -> FracIdx {
    let empty = FracIdx::default();
    let before = &before.unwrap_or(&empty).0.as_bytes();
    let after = &after.unwrap_or(&empty).0.as_bytes();

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

        // let mut jitter = rng.gen_range(0..MAX_JITTER);
        // while jitter > 0 {
        //     let base = u8::MAX as u16;
        //     let modulo = jitter % base;
        //     jitter = (jitter - modulo) / base;
        //     result.push(modulo as u8);
        // }

        let result = AsciiString::from_ascii(result).expect("is ascii");
        return FracIdx(result);
    }
}

impl TryFrom<AsciiString> for FracIdx {
    type Error = NotInAlphabetError;

    fn try_from(value: AsciiString) -> Result<Self, Self::Error> {
        for char in value.chars() {
            if !(MIN_DIGIT..=MAX_DIGIT).contains(&char) {
                return Err(NotInAlphabetError(char));
            }
        }
        Ok(Self(value))
    }
}

#[derive(Clone, PartialEq, Eq, Debug)]
pub struct NotInAlphabetError(AsciiChar);

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
                self.visit_string(v.to_owned())
            }

            fn visit_string<E>(self, v: String) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                let v = AsciiString::from_ascii(v).map_err(|err| {
                    E::custom(format!("FracIdx not ascii: got {}", err.into_source()))
                })?;
                FracIdx::try_from(v).map_err(|e| E::custom(e.to_string()))
            }
        }
        de.deserialize_string(FracIdxVisitor)
    }
}

impl fmt::Display for FracIdx {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}
