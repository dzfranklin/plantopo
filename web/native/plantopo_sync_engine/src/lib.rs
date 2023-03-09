macro_rules! err {
    ($name:ident) => {{
        rustler::Error::Term(Box::new(crate::atoms::$name()))
    }};
    ($name:ident, $err:expr) => {{
        rustler::Error::Term(Box::new((crate::atoms::$name(), $err.to_string())))
    }};
    ($name:ident, ?$err:expr) => {{
        rustler::Error::Term(Box::new((crate::atoms::$name(), format!("{:?}", $err))))
    }};
}

macro_rules! Ok {
    ($value:expr) => {{
        Ok((crate::atoms::ok(), $value))
    }};
    () => {{
        Ok(crate::atoms::ok())
    }};
}

type Result<T> = std::result::Result<(Atom, T), rustler::Error>;
type EmptyResult = std::result::Result<Atom, rustler::Error>;

mod awareness;
mod awareness_update;
mod lock;
mod message;
mod state_vector;

pub use awareness::{
    apply_awareness_update, apply_update, awareness_new, encode_awareness_update, encode_intro,
    encode_state_as_update, serialize_data, serialize_snapshot_if_changed, Awareness,
};
pub use awareness_update::{awareness_update_to_map, AwarenessUpdate};
pub use lock::{Lock, Locked};
pub use message::{
    message_decode, message_encode, message_encoder_finish, message_encoder_new,
    message_encoder_write, MessageEncoder,
};
pub use state_vector::StateVector;

use rustler::{resource, Atom, Env, Term};

mod atoms {
    rustler::atoms! {
        ok,
        // errors
        lock,
        encode,
        decode,
        no_data,
        finished
    }
}

fn load(env: Env, _: Term) -> bool {
    resource!(Awareness, env);
    resource!(AwarenessUpdate, env);
    resource!(StateVector, env);
    resource!(MessageEncoder, env);
    true
}

rustler::init!(
    "Elixir.PlanTopo.Sync.EngineNative",
    [
        message_decode,
        message_encode,
        message_encoder_new,
        message_encoder_write,
        message_encoder_finish,
        awareness_update_to_map,
        awareness_new,
        apply_update,
        apply_awareness_update,
        serialize_data,
        serialize_snapshot_if_changed,
        encode_awareness_update,
        encode_state_as_update,
        encode_intro,
    ],
    load = load
);
