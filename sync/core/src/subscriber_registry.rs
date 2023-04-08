use crate::prelude::*;

/// V should be cheap to clone.
pub struct SubscriberRegistry<K, F> {
    subs: BTreeMap<K, BTreeMap<u32, F>>,
    handles: BTreeMap<u32, K>,
    next_handle: u32,
}

impl<K, F> SubscriberRegistry<K, F>
where
    K: Ord + Clone,
{
    pub fn new() -> Self {
        Self {
            subs: BTreeMap::new(),
            handles: BTreeMap::new(),
            next_handle: 0,
        }
    }

    pub fn call<V>(&self, k: &K, value: V)
    where
        F: Fn(V),
        V: Clone,
    {
        if let Some(subs) = self.subs.get(k) {
            for (_, sub) in subs.iter() {
                sub(value.clone());
            }
        }
    }

    pub fn insert(&mut self, k: K, f: F) -> u32 {
        let handle = self.next_handle;
        self.next_handle += 1;

        self.handles.insert(handle, k.clone());

        self.subs
            .entry(k)
            .or_insert_with(BTreeMap::new)
            .insert(handle, f);

        handle
    }

    pub fn remove(&mut self, handle: u32) {
        if let Some(k) = self.handles.remove(&handle) && let Some(subs) = self.subs.get_mut(&k) {
        subs.remove(&handle);
      }
    }
}

impl<K, V> fmt::Debug for SubscriberRegistry<K, V>
where
    K: fmt::Debug,
{
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("SubscriberRegistry")
            .field("subs", &SubsFmt(&self.subs))
            .field("handles", &self.handles)
            .field("next_handle", &self.next_handle)
            .finish()
    }
}

struct SubsFmt<'a, K, F>(&'a BTreeMap<K, BTreeMap<u32, F>>);

impl<'a, K, F> fmt::Debug for SubsFmt<'a, K, F>
where
    K: fmt::Debug,
{
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_map()
            .entries(self.0.iter().map(|(k, v)| (k, SubsFmtChild(v))))
            .finish()
    }
}

struct SubsFmtChild<'a, F>(&'a BTreeMap<u32, F>);

impl<'a, F> fmt::Debug for SubsFmtChild<'a, F> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_map()
            .entries(self.0.iter().map(|(k, _v)| (k, ElidedF)))
            .finish()
    }
}

struct ElidedF;

impl fmt::Debug for ElidedF {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("impl Fn(_)")
    }
}
