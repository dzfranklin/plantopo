use crate::prelude::*;

// Based on <https://madebyevan.com/algos/crdt-fractional-indexing/>

const MAX_JITTER: u16 = 4096;

#[derive(PartialEq, Eq, PartialOrd, Ord, Clone, Default)]
pub struct FracIdx(SmallVec<[u8; 8]>);

impl FracIdx {
    pub fn between(
        before: Option<&FracIdx>,
        after: Option<&FracIdx>,
        rng: &mut impl RngCore,
    ) -> Self {
        let empty = Self(SmallVec::new());
        let before = &before.unwrap_or(&empty).0;
        let after = &after.unwrap_or(&empty).0;

        let mut found_difference = false;
        let mut result = SmallVec::new();
        let mut i = 0;

        loop {
            let digit_before = *before.get(i).unwrap_or(&0);
            let digit_after = if !found_difference && i < after.len() {
                after[i]
            } else {
                u8::MAX
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
                result.push(modulo as u8);
            }
            return Self(result);
        }
    }

    pub fn as_slice(&self) -> &[u8] {
        &self.0
    }

    pub fn from_slice(slice: &[u8]) -> Self {
        Self(slice.into())
    }
}

const MAX_DEBUG_LEN: usize = 20;

impl fmt::Debug for FracIdx {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "FracIdx(")?;
        if self.0.len() <= MAX_DEBUG_LEN {
            for byte in &self.0[..self.0.len() - 1] {
                write!(f, "{:02x} ", byte)?;
            }
            write!(f, "{:02x}", self.0[self.0.len() - 1])?;
        } else {
            for byte in &self.0[..MAX_DEBUG_LEN / 2] {
                write!(f, "{:02x} ", byte)?;
            }
            write!(f, "... ")?;
            for byte in &self.0[self.0.len() - MAX_DEBUG_LEN / 2..self.0.len() - 1] {
                write!(f, "{:02x} ", byte)?;
            }
            write!(f, "{:02x}", self.0[self.0.len() - 1])?;
        }
        write!(f, ")")?;
        Ok(())
    }
}
