@0xdc6da73625938628;

using import "types.capnp".Uuid;
using import "types.capnp".LInstant;
using import "delta.capnp".Delta;

struct Save {
  clientId @0 :UInt64;
  mapId @1 :Uuid;
  clock @2 :LInstant;
  state @3 :Delta;
}

