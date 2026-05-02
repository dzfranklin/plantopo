import { customType } from "drizzle-orm/pg-core";
import wkx from "wkx";

import type { Point } from "@pt/shared";

export const lineString = customType<{ data: Point[]; driverData: Buffer }>({
  dataType() {
    return "geometry(LineString,4326)";
  },
  toDriver(value) {
    const line = new wkx.LineString(
      value.map(([lng, lat]) => new wkx.Point(lng, lat)),
      4326,
    );
    return line.toEwkb();
  },
  fromDriver(value) {
    let buf: Buffer;
    if (typeof value === "string") {
      buf = Buffer.from(value, "hex");
    } else if (Buffer.isBuffer(value)) {
      buf = value;
    } else {
      throw new Error(`Unexpected value type: ${typeof value}`);
    }
    const geom = wkx.Geometry.parse(buf);
    if (!(geom instanceof wkx.LineString)) {
      throw new Error(`Expected LineString, got ${geom.constructor.name}`);
    }
    return geom.points.map(p => [p.x, p.y]);
  },
});
