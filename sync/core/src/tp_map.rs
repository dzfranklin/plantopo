use crate::prelude::*;

/// Two-Phase map
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct TPMap<K: Ord, V> {
    live: BTreeMap<K, V>,
    dead: BTreeMap<K, LInstant>,
}

impl<K: Ord, V> TPMap<K, V> {
    pub fn new() -> Self {
        Self {
            live: BTreeMap::new(),
            dead: BTreeMap::new(),
        }
    }

    pub fn from_entries(
        live: impl IntoIterator<Item = (K, V)>,
        dead: impl IntoIterator<Item = (K, LInstant)>,
    ) -> Self {
        Self {
            live: live.into_iter().collect(),
            dead: dead.into_iter().collect(),
        }
    }

    pub fn get(&self, key: &K) -> Option<&V> {
        self.live.get(key)
    }

    pub fn contains_key(&self, key: &K) -> bool {
        self.live.contains_key(key)
    }

    pub fn insert(&mut self, key: K, value: V) -> core::result::Result<(), (K, V)> {
        if self.dead.contains_key(&key) {
            Err((key, value))
        } else if self.live.contains_key(&key) {
            Err((key, value))
        } else {
            self.live.insert(key, value);
            Ok(())
        }
    }

    pub fn merge_value<O>(&mut self, key: K, value: O) -> core::result::Result<(), (K, O)>
    where
        V: Merge<O>,
    {
        if let Some(existing) = self.live.get_mut(&key) {
            existing.merge(value);
            Ok(())
        } else {
            Err((key, value))
        }
    }

    pub fn delete(&mut self, key: K, ts: LInstant) -> core::result::Result<V, ()> {
        let value = self.live.remove(&key);
        self.dead.insert(key, ts);
        value.ok_or(())
    }

    pub fn iter(&self) -> Iter<'_, K, V> {
        Iter(self.live.iter())
    }

    pub fn iter_dead(&self) -> IterDead<'_, K> {
        IterDead(self.dead.iter())
    }
}

impl<K: Ord, V: Merge> Merge for TPMap<K, V> {
    fn merge(&mut self, other: Self) {
        for (key, ts) in other.dead {
            self.live.remove(&key);
            if !self.dead.contains_key(&key) {
                self.dead.insert(key, ts);
            }
        }

        for (key, value) in other.live {
            if self.dead.contains_key(&key) {
                continue;
            }

            if let Err((key, value)) = self.merge_value(key, value) {
                self.live.insert(key, value);
            }
        }
    }
}

impl<K: Ord, V> Default for TPMap<K, V> {
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

#[derive(Debug, Clone)]
pub struct IterDead<'a, K>(btree_map::Iter<'a, K, LInstant>);

impl<'a, K> Iterator for IterDead<'a, K> {
    type Item = (&'a K, LInstant);

    fn next(&mut self) -> Option<Self::Item> {
        self.0.next().map(|(k, v)| (k, *v))
    }
}
