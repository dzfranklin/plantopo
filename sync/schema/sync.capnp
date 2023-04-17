@0xbaa2e97481cc6e4c;

using import "types.capnp".LInstant;
using import "delta.capnp".Delta;

struct Message {
  ts @0 :LInstant;

  union {
    delta @1 :Delta;
    error @2 :Error;
  }
}

struct Error {
  code @0 :UInt16;
  description @1 :Text;
}

