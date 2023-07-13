@0xeb9d1f49cbc9206b;

using Style = import "style.capnp";
using Core = import "core.capnp";

struct Map {
  id @0 :Core.MapId; # Required & immutable
  full @1 :Bool; # Required. Whether this represents a delta update
  lastUpdated @2 :Core.PInstant; # Required
  clock @3 :Core.LInstant; # Required

  name @4 :Core.Reg(Text);

  aware @5 :List(Aware);

  layers @6 :List(Layer);

  features :group {
    live @7 :List(Feature);
    dead @8 :List(FeatureId);
  }
}

using FeatureId = Core.LInstant;
using LayerId = Core.Uuid;

struct Aware {
  # This has the semantics of a single lww register with no guarantee of
  # persistence.

  client @0 :Core.ClientId;
  auth @1 :Auth;
  entry @2 :Entry;

  struct Auth {
    user @0 :Core.UserId;
    username @1 :Text;
  }

  struct Entry {
    lastUpdated @2 :Core.PInstant;
    cameraLocation @0 :CameraLocation;
    activeFeatures @1 :List(FeatureId);
  }
}

struct CameraLocation {
  center @0 :Core.LngLat;
  zoom @1 :Float32;
  pitch @2 :Float32;
  bearing @3 :Float32;
}

struct Layer {
  id @0 :LayerId;
  at @1 :Core.Reg(Core.FracIdx);
  opacity @2 :Core.FloatReg;
}

struct Feature {
  id @0 :FeatureId;
  at @1 :Core.Reg(At);

  name @2 :Core.Reg(Text);
  details @3 :Core.Reg(Text);
  hidden @4 :Core.BoolReg;

  union {
    point :group {
      coords @5 :Core.Reg(Core.LngLat);
      style @7 :Style.Point;
    }

    group :group {
      pointStyle @6 :Style.Point;
    }
  }

  struct At {
    parent @0 :FeatureId;
    idx @1 :Core.FracIdx;
  }
}
