@0xbaa2e97481cc6e4c;

using import "types.capnp".LInstant;
using import "types.capnp".Uuid;

struct Message {
  union {
    error @0 :Error;
    auth @1 :Auth; # Sent by the client as the first message.
    delta @2 :import "delta.capnp".Delta;
    confirmDelta @3 :ConfirmDelta;
    aware @4 :import "aware.capnp".Store;
  }
}

struct Auth {
  token @0 :Text;
}

struct Error {
  code @0 :UInt16;
  description @1 :Text;
}

struct ConfirmDelta {
  deltaTs @0 :LInstant;
}



const parseError :UInt16 = 2;
const invalidError :UInt16 = 3;
const writeForbiddenError :UInt16 = 4;
const accessForbiddenError :UInt16 = 5;
const serverError :UInt16 = 6;

