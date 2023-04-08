use crate::prelude::*;

/// Last-writer-wins grow-only map
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct GMap<K: Ord, V>(BTreeMap<K, V>);

impl<K: Ord, V> GMap<K, V> {
    pub fn new() -> Self {
        Self(BTreeMap::new())
    }

    pub fn from_entries(entries: impl IntoIterator<Item = (K, V)>) -> Self {
        Self(entries.into_iter().collect())
    }

    pub fn get(&self, key: &K) -> Option<&V> {
        self.0.get(key)
    }

    pub fn merge_value<O>(&mut self, key: K, value: O) -> core::result::Result<(), (K, O)>
    where
        V: Merge<O>,
    {
        if let Some(existing) = self.0.get_mut(&key) {
            existing.merge(value);
            Ok(())
        } else {
            Err((key, value))
        }
    }

    pub fn insert(&mut self, key: K, value: V) -> core::result::Result<(), (K, V)> {
        if self.0.contains_key(&key) {
            Err((key, value))
        } else {
            self.0.insert(key, value);
            Ok(())
        }
    }

    pub fn iter(&self) -> Iter<'_, K, V> {
        Iter(self.0.iter())
    }

    pub fn len(&self) -> usize {
        self.0.len()
    }
}

impl<K: Ord, V: Merge> Merge for GMap<K, V> {
    fn merge(&mut self, other: Self) {
        for (key, value) in other.0 {
            if let Err((key, value)) = self.merge_value(key, value) {
                let _ = self.insert(key, value);
            }
        }
    }
}

impl<K: Ord, V> Default for GMap<K, V> {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Clone)]
pub struct Iter<'a, K, V>(btree_map::Iter<'a, K, V>);

impl<'a, K, V> Iterator for Iter<'a, K, V> {
    type Item = (&'a K, &'a V);

    fn next(&mut self) -> Option<Self::Item> {
        self.0.next()
    }
}
