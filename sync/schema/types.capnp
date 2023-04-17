@0xebd2b3ce4ff01543;

struct LInstant {
  client @0 :UInt64;
  counter @1 :UInt64;
}

struct Uuid {
  d1 @0 :UInt32;
  d2 @1 :UInt16;
  d3 @2 :UInt16;
  d4 @3 :UInt64;
}


struct FracIdx {
  value @0 :List(UInt8);
}
