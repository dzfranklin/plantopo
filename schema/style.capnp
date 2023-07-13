@0x93a49b14b3e580f2;

using Json = import "/capnp/compat/json.capnp";

using Core = import "core.capnp";

struct Point {
  # Icon paint
  iconColor @0 :Core.Reg(Color);
  iconHaloBlur @1 :Core.FloatReg;
  iconHaloColor @2 :Core.Reg(Color);
  iconHaloWidth @3 :Core.FloatReg;
  iconOpacity @4 :Core.FloatReg;

  # Text paint
  textColor @5 :Core.Reg(Color);
  textHaloBlur @6 :Core.FloatReg;
  textHaloColor @7 :Core.Reg(Color);
  textHaloWidth @8 :Core.FloatReg;
  textOpacity @9 :Core.FloatReg;

  # Icon layout
  iconAnchor @10 :AnchorReg;
  iconImage @11 :SpriteReg;
  iconOffset @12 :Core.Reg(Offset);
  iconSize @13 :Core.FloatReg;
  iconSizeZoomedOutMultiplier @14 :Core.FloatReg;

  # Text layout
  textAnchor @15 :AnchorReg;
  textFont @16 :FontReg;
  textJustifyReg @17 :JustifyReg;
  textLetterSpacing @18 :Core.FloatReg;
  textMaxWidth @19 :Core.FloatReg;
  textOffset @20 :Core.Reg(Offset);
  textRotate @21 :Core.FloatReg;
  textSize @22 :Core.FloatReg;
}

struct FontReg {
  ts @0 :Core.LInstant $Core.regTs;
  value @1 :UInt16 $Core.regValue;
}

struct SpriteReg {
  ts @0 :Core.LInstant $Core.regTs;
  value @1 :UInt16 $Core.regValue;
}

struct AnchorReg {
  ts @0 :Core.LInstant $Core.regTs;
  value @1 :Anchor $Core.regValue;
}

enum Anchor {
  # JSON annotaiton to rename to kebab to directly match maplibre
  center @0;
  left @1;
  right @2;
  top @3;
  bottom @4;
  topLeft @5 $Json.name("top-left");
  topRight @6 $Json.name("top-right");
  bottomLeft @7 $Json.name("bottom-left");
  bottomRight @8 $Json.name("bottom-right");
}

struct JustifyReg {
  ts @0 :Core.LInstant;
  value @1 :JustifyReg;
}

enum Justify {
  auto @0;
  left @1;
  center @2;
  right @3;
}

struct Offset {
  x @0 :Float32;
  y @1 :Float32;
}

struct Color {
  # TODO: JSON serialize to hex
  r @0 :UInt8;
  g @1 :UInt8;
  b @2 :UInt8;
}
