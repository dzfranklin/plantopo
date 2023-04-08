use crate::prelude::*;

#[derive(PartialEq, Clone, Debug)]
pub struct AttrPairRef<'a>(pub &'a SmolStr, pub &'a AttrValue);

#[derive(PartialEq, Eq, Clone, Serialize, Deserialize)]
#[non_exhaustive]
pub enum AttrValue {
    None,
    Bool(bool),
    String(SmolStr),
    Number(OrderedFloat<f64>),
    NumberArray(SmallVec<[OrderedFloat<f64>; 4]>),
    StringArray(SmallVec<[SmolStr; 4]>),
}

impl<'a> Serialize for AttrPairRef<'a> {
    fn serialize<S>(&self, ser: S) -> core::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let AttrPairRef(k, v) = &self;
        let mut ser = ser.serialize_tuple(2)?;
        ser.serialize_element(k)?;
        match v {
            AttrValue::None => ser.serialize_element(&None::<()>)?,
            AttrValue::Bool(v) => ser.serialize_element(v)?,
            AttrValue::String(v) => ser.serialize_element(v)?,
            AttrValue::Number(v) => ser.serialize_element(v)?,
            AttrValue::NumberArray(v) => ser.serialize_element(v)?,
            AttrValue::StringArray(v) => ser.serialize_element(v)?,
        }
        ser.end()
    }
}

impl AttrValue {
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

impl Default for AttrValue {
    fn default() -> Self {
        Self::None
    }
}

impl fmt::Debug for AttrValue {
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
