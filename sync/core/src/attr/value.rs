use crate::prelude::*;

#[derive(PartialEq, Eq, Clone)]
#[non_exhaustive]
pub enum Value {
    None,
    Bool(bool),
    String(SmolStr),
    Number(OrderedFloat<f64>),
    NumberArray(SmallVec<[OrderedFloat<f64>; 4]>),
    StringArray(SmallVec<[SmolStr; 4]>),
}

impl Value {
    pub fn string(v: impl Into<SmolStr>) -> Self {
        Self::String(v.into())
    }

    pub fn string_array(v: impl IntoIterator<Item = impl Into<SmolStr>>) -> Self {
        Self::StringArray(v.into_iter().map(|v| v.into()).collect())
    }

    pub fn number(v: f64) -> Self {
        Self::Number(OrderedFloat(v))
    }

    pub fn number_array(v: impl IntoIterator<Item = impl Into<OrderedFloat<f64>>>) -> Self {
        Self::NumberArray(v.into_iter().map(|v| v.into()).collect())
    }
}

impl Default for Value {
    fn default() -> Self {
        Self::None
    }
}

impl fmt::Debug for Value {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::None => write!(f, "None"),
            Self::Bool(v) => write!(f, "Bool({})", v),
            Self::String(v) => write!(f, "String({})", v),
            Self::Number(v) => write!(f, "Number({})", v),
            Self::NumberArray(v) => {
                write!(f, "NumberArray([")?;
                for (i, v) in v.iter().enumerate() {
                    if i > 0 {
                        write!(f, ", ")?;
                    }
                    write!(f, "{}", v)?;
                }
                write!(f, "])")?;
                Ok(())
            }
            Self::StringArray(v) => {
                write!(f, "StringArray([")?;
                for (i, v) in v.iter().enumerate() {
                    if i > 0 {
                        write!(f, ", ")?;
                    }
                    write!(f, "\"{}\"", v)?;
                }
                write!(f, "])")?;
                Ok(())
            }
        }
    }
}
