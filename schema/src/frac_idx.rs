// Based on <https://madebyevan.com/algos/crdt-fractional-indexing/>

use compact_str::CompactString;
use rand::{Rng, RngCore};

const MAX_JITTER: u16 = 4096;
const MIN: u8 = 0x20;
const MAX: u8 = 0x7d;
const HOLE: u8 = b'"';

pub fn validate(value: &str) -> Result<(), MalformedFracIdx> {
    for byte in value.bytes() {
        if byte < MIN || byte > MAX || byte == HOLE {
            return Err(MalformedFracIdx);
        }
    }
    Ok(())
}

/// Empty before represents 0, empty after represents 1.
pub fn between(
    before: &str,
    after: &str,
    rng: &mut impl RngCore,
) -> Result<CompactString, MalformedFracIdx> {
    let mut found_difference = false;
    let mut result = CompactString::with_capacity(before.len().max(after.len()) + 1);
    let mut i = 0;

    let before = before.as_bytes();
    let after = after.as_bytes();

    loop {
        let digit_before = *before.get(i).unwrap_or(&MIN);
        let digit_after = if !found_difference && i < after.len() {
            after[i]
        } else {
            MAX
        };

        if digit_before < MIN || digit_before > MAX || digit_before == HOLE {
            return Err(MalformedFracIdx);
        }
        if digit_after < MIN || digit_after > MAX || digit_after == HOLE {
            return Err(MalformedFracIdx);
        }

        let pick = ((digit_before as u16 + digit_after as u16) >> 1_u16) as u8;

        // Leave a hole where the quotation mark would be
        if pick < HOLE {
            result.push(pick as char);
        } else {
            result.push((pick + 1) as char);
        }

        if pick <= digit_before {
            if digit_before < digit_after {
                found_difference = true;
            }

            i += 1;
            continue;
        }

        let mut jitter = rng.gen_range(0..MAX_JITTER);
        while jitter > 0 {
            let base = (MAX - MIN + 1) as u16;
            let modulo = jitter % base;
            jitter = (jitter - modulo) / base;
            let pick = MIN + modulo as u8;
            if pick < HOLE {
                result.push(pick as char);
            } else {
                result.push((pick + 1) as char);
            }
        }

        return Ok(result);
    }
}

#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub struct MalformedFracIdx;

impl std::error::Error for MalformedFracIdx {}

impl std::fmt::Display for MalformedFracIdx {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "malformed frac idx")
    }
}
