use crate::{delta_capnp, prelude::*, types_capnp};

pub(crate) fn read_uuid(r: types_capnp::uuid::Reader) -> Uuid {
    let d4 = r.get_d4().to_be_bytes();
    Uuid::from_fields(r.get_d1(), r.get_d2(), r.get_d3(), &d4)
}

pub(crate) fn write_uuid(mut b: types_capnp::uuid::Builder, uuid: Uuid) {
    let (d1, d2, d3, d4) = uuid.as_fields();
    let d4 = u64::from_be_bytes(*d4);
    b.set_d1(d1);
    b.set_d2(d2);
    b.set_d3(d3);
    b.set_d4(d4);
}

pub(crate) fn read_l_instant(r: types_capnp::l_instant::Reader) -> LInstant {
    LInstant::new(ClientId(r.get_client()), r.get_counter())
}

pub(crate) fn write_l_instant(mut b: types_capnp::l_instant::Builder, instant: LInstant) {
    b.set_client(instant.client.0);
    b.set_counter(instant.counter);
}

pub(crate) fn read_frac_idx(r: types_capnp::frac_idx::Reader) -> capnp::Result<FracIdx> {
    r.get_value()?
        .as_slice()
        .ok_or_else(|| capnp::Error::failed("frac idx not as expected in memory".to_string()))
        .map(FracIdx::from_slice)
}

pub(crate) fn write_frac_idx(b: types_capnp::frac_idx::Builder, idx: &FracIdx) {
    let idx = idx.as_slice();
    let mut b = b.init_value(idx.len() as u32);
    b.as_slice()
        .expect("correct element size")
        .copy_from_slice(idx);
}

pub(crate) fn write_attr(
    mut b: delta_capnp::delta::attrs::attr::Builder,
    key: attr::Key,
    value: &attr::Value,
    ts: LInstant,
) {
    use attr::Value;
    b.set_key(key.into());
    write_l_instant(b.reborrow().init_ts(), ts);

    let mut b = b.init_value();
    match value {
        Value::None => b.set_none(()),
        Value::Bool(v) => b.set_bool(*v),
        Value::String(v) => {
            let mut b = b.init_string(v.len() as u32);
            b.push_str(v.as_str());
        }
        Value::Number(v) => b.set_number(v.into_inner()),
        Value::NumberArray(v) => {
            let mut b = b.init_number_array(v.len() as u32);
            for (i, v) in v.iter().enumerate() {
                b.set(i as u32, v.into_inner());
            }
        }
        Value::StringArray(v) => {
            let mut b = b.init_string_array(v.len() as u32);
            for (i, v) in v.iter().enumerate() {
                b.reborrow().set(i as u32, v.as_str());
            }
        }
    }
}
