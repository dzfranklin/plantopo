use std::{
    collections::{hash_map, HashMap, HashSet},
    marker::PhantomData,
    ops::AddAssign,
};

use serde::{ser::SerializeSeq, Deserialize, Deserializer, Serialize, Serializer};
use serde_json::Value;

use crate::{fid::Fid, lid::Lid, Key};

type FlatPropsMap<Id> = HashMap<(Id, Key), Value>;

#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
pub struct Change {
    #[serde(
        serialize_with = "serialize_props",
        deserialize_with = "deserialize_props"
    )]
    pub fprops: FlatPropsMap<Fid>,
    #[serde(
        serialize_with = "serialize_props",
        deserialize_with = "deserialize_props"
    )]
    pub lprops: FlatPropsMap<Lid>,
    /// Must be applied after `fprops`
    pub fdeletes: HashSet<Fid>,
}

impl Change {
    pub fn fset(&mut self, fid: Fid, key: impl Into<Key>, value: Value) {
        self.fprops.insert((fid, key.into()), value);
    }

    pub fn lset(&mut self, lid: Lid, key: impl Into<Key>, value: Value) {
        self.lprops.insert((lid, key.into()), value);
    }

    pub fn fdelete(&mut self, fid: Fid) {
        self.fdeletes.insert(fid);
    }

    pub fn is_empty(&self) -> bool {
        self.fprops.is_empty() && self.fdeletes.is_empty() && self.lprops.is_empty()
    }
}

impl AddAssign<Change> for Change {
    fn add_assign(&mut self, rhs: Change) {
        self.fprops.extend(rhs.fprops);
        self.lprops.extend(rhs.lprops);
        self.fdeletes.extend(rhs.fdeletes);
    }
}

fn serialize_props<S, Id>(props: &FlatPropsMap<Id>, ser: S) -> Result<S::Ok, S::Error>
where
    Id: Serialize,
    S: Serializer,
{
    let mut ser = ser.serialize_seq(Some(props.len()))?;
    for ((fid, k), v) in props.iter() {
        ser.serialize_element(&(fid, k, v))?;
    }
    ser.end()
}

fn deserialize_props<'de, D, Id>(de: D) -> Result<FlatPropsMap<Id>, D::Error>
where
    Id: Deserialize<'de> + Eq + std::hash::Hash,
    D: Deserializer<'de>,
{
    struct PropsVisitor<Id> {
        _id: PhantomData<Id>,
    }

    impl<'de, Id> serde::de::Visitor<'de> for PropsVisitor<Id>
    where
        Id: Deserialize<'de> + Eq + std::hash::Hash,
    {
        type Value = FlatPropsMap<Id>;

        fn expecting(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
            write!(f, "a sequence (id, key, value)")
        }

        fn visit_seq<A>(self, mut seq: A) -> Result<Self::Value, A::Error>
        where
            A: serde::de::SeqAccess<'de>,
        {
            let mut props = HashMap::with_capacity(seq.size_hint().unwrap_or(0));
            while let Some((id, k, v)) = seq.next_element()? {
                props.insert((id, k), v);
            }
            Ok(props)
        }
    }

    de.deserialize_seq(PropsVisitor { _id: PhantomData })
}

pub struct PropsIter<'a, Id>(hash_map::Iter<'a, (Id, Key), Value>);

impl<'a, Id> Iterator for PropsIter<'a, Id>
where
    Id: Copy,
{
    type Item = (Id, &'a Key, &'a Value);

    fn next(&mut self) -> Option<Self::Item> {
        self.0.next().map(|((id, k), v)| (*id, k, v))
    }
}
