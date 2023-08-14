use std::{
    collections::{hash_map, HashMap, HashSet},
    marker::PhantomData,
    ops::AddAssign,
};

use serde::{ser::SerializeSeq, Deserialize, Deserializer, Serialize, Serializer};
use serde_json::Value;

use crate::{fid::Fid, lid::Lid, Key};

type FlatPropsMap<Id> = HashMap<(Id, Key), Option<Value>>;

#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
pub struct Change {
    #[serde(
        serialize_with = "serialize_props",
        deserialize_with = "deserialize_props"
    )]
    feature_props: FlatPropsMap<Fid>,
    #[serde(
        serialize_with = "serialize_props",
        deserialize_with = "deserialize_props"
    )]
    layer_props: FlatPropsMap<Lid>,
    deleted_features: HashSet<Fid>,
}

impl Change {
    pub fn set_fprop(&mut self, fid: Fid, key: impl Into<Key>, value: Option<Value>) {
        self.feature_props.insert((fid, key.into()), value);
    }

    pub fn set_lprop(&mut self, lid: Lid, key: impl Into<Key>, value: Option<Value>) {
        self.layer_props.insert((lid, key.into()), value);
    }

    pub fn add_fdelete(&mut self, fid: Fid) {
        self.deleted_features.insert(fid);
    }

    pub fn iter_fprops(&self) -> PropsIter<'_, Fid> {
        PropsIter(self.feature_props.iter())
    }

    pub fn iter_lprops(&self) -> PropsIter<'_, Lid> {
        PropsIter(self.layer_props.iter())
    }

    pub fn deleted_features(&self) -> &HashSet<Fid> {
        &self.deleted_features
    }

    pub fn is_empty(&self) -> bool {
        self.feature_props.is_empty()
            && self.deleted_features.is_empty()
            && self.layer_props.is_empty()
    }
}

impl AddAssign<Change> for Change {
    fn add_assign(&mut self, rhs: Change) {
        self.feature_props.extend(rhs.feature_props);
        self.layer_props.extend(rhs.layer_props);
        self.deleted_features.extend(rhs.deleted_features);
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

pub struct PropsIter<'a, Id>(hash_map::Iter<'a, (Id, Key), Option<Value>>);

impl<'a, Id> Iterator for PropsIter<'a, Id>
where
    Id: Copy,
{
    type Item = (Id, &'a Key, Option<&'a Value>);

    fn next(&mut self) -> Option<Self::Item> {
        self.0.next().map(|((id, k), v)| (*id, k, v.as_ref()))
    }
}
