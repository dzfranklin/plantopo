pub trait Merge<Other = Self> {
    fn merge(&mut self, other: Other);
}
