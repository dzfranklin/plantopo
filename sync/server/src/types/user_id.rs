use crate::prelude::*;

#[derive(Deserialize, Serialize, Clone, Copy, Eq, PartialEq, Hash)]
pub struct UserId(pub Uuid);

impl fmt::Debug for UserId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "UserId({})", self.0)
    }
}
