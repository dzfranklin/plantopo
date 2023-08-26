use redis::{FromRedisValue, RedisError, ToRedisArgs};
use serde::{Deserialize, Serialize};

use crate::SPECIAL_FID_UNTIL;

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Metadata {
    pub next_fid_block_start: u64,
}

impl Default for Metadata {
    fn default() -> Self {
        Self {
            next_fid_block_start: SPECIAL_FID_UNTIL,
        }
    }
}

impl FromRedisValue for Metadata {
    fn from_redis_value(value: &redis::Value) -> redis::RedisResult<Self> {
        use redis::Value;
        match value {
            Value::Nil => Ok(Self::default()),
            Value::Data(value) => serde_json::from_slice(value).map_err(|err| {
                RedisError::from((
                    redis::ErrorKind::Serialize,
                    "deserialize Metadata",
                    format!("{err}"),
                ))
            }),
            _ => Err(RedisError::from((
                redis::ErrorKind::Serialize,
                "deserialize Metadata: expected Data or Nil",
                format!("got {:?}", value),
            ))),
        }
    }
}

impl ToRedisArgs for Metadata {
    fn write_redis_args<W>(&self, out: &mut W)
    where
        W: ?Sized + redis::RedisWrite,
    {
        let value = serde_json::to_vec(self).expect("infallible serialize");
        out.write_arg(&value);
    }
}
