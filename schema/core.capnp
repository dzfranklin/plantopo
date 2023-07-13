@0xc00e7f6be078dbab;

annotation regTs @0x9dc2f38d930ae28f (field) :Void;
annotation regValue @0xaf2e4098fd37c216 (field) :Void;

struct Reg(T) {
  # A last-writer-wins register
  ts @0 :LInstant $regTs;
  value @1 :T $regValue;
}

struct FloatReg {
  ts @0 :LInstant $regTs;
  value @1 :Float32 $regValue;
}

struct BoolReg {
  ts @0 :LInstant $regTs;
  value @1 :Bool $regValue;
}

using ClientId = UInt32; # [0, 2^26)

using LInstant = UInt64;
# Logical clock timestamp.
#
# client: n - counter * 2^26 [0, 2^26)
# counter: floor(n / 2^26) [0, 2^27)
#
# Representation: counter * 2^26 + client.
# This sorts correctly and fits within the JS MAX_SAFE_INTEGER as
# (2^27-1)*(2^26)+(2^26-1)=2^52-1

using FracIdx = Text;
# A fractional index. See frac_idx.rs for details

struct Uuid {
  d1 @0 :UInt32; # uuid field 1
  d2 @1 :UInt16; # uuid field 2
  d3 @2 :UInt16; # uuid field 3
  d4 @3 :UInt64; # uuid field 4
}

using UserId = Uuid;
using MapId = Uuid;
using PInstant = UInt64; # Physical clock timestamp in milliseconds since unix epoch


struct LngLat {
  lng @0 :Float64;
  lat @1 :Float64;
}

