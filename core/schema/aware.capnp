@0x993e7caf3d326c24;

using import "types.capnp".LInstant;
using import "types.capnp".Uuid;

struct Store {
  value @0 :List(Entry);
}

struct Entry {
  client @0 :UInt64;

  disconnect @1 :Bool;
  # To indicate disconnect send just client and disconnect=true

  isServer @2 :Bool;

  user @3 :Uuid;
  activeFeatures @4 :List(LInstant);
}
