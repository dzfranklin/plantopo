@0xdd0dbecd7b615b08;

using import "types.capnp".LInstant;
using import "types.capnp".Uuid;
using import "types.capnp".FracIdx;

struct Delta {
  confirmKey @0 :LInstant;

  aware @4 :import "aware.capnp".Store;

  layers @1 :LayerStore;
  features @2 :FeatureStore;
  attrs @3 :Attrs;

  struct LayerStore {
    value @0 :List(Layer);

    struct Layer {
      id @0 :Uuid;

      at @1 :FracIdx;
      atTs @2 :LInstant;

      attrs @3 :Attrs;
    }
  }

  struct FeatureStore {
    live @0 :List(Feature);
    dead @1 :List(DeadFeature);

    struct Feature {
      id @0 :LInstant;
      type @1 :UInt8;

      atIdx @2 :FracIdx;
      atParent @3 :LInstant;
      atTs @4 :LInstant;

      attrs @5 :Attrs;
    }

    struct DeadFeature {
      id @0 :LInstant;
    }
  }

  struct Attrs {
    value @0 :List(Attr);

    struct Attr {
      ts @0 :LInstant;
      key @1 :Text;
      value :union {
        none @2 :Void;
        bool @3 :Bool;
        string @4 :Text;
        number @5 :Float64;
        numberArray @6 :List(Float64);
        stringArray @7 :List(Text);
      }
    }
  }
}
