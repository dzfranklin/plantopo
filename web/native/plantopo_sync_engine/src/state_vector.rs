use rustler::ResourceArc;
use yrs::StateVector as YStateVector;

pub struct StateVector(pub(crate) YStateVector);

impl StateVector {
    pub fn new(inner: YStateVector) -> ResourceArc<Self> {
        ResourceArc::new(Self(inner))
    }
}
