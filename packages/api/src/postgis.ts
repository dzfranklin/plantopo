import { customType } from "drizzle-orm/pg-core";
import wkx from "wkx";

import type { Point2 } from "@pt/shared";

export interface LatLng {
  lat: number;
  lng: number;
}

export const point = customType<{
  data: LatLng | null;
  driverData: Buffer | null;
}>({
  dataType() {
    return "geometry(Point,4326)";
  },
  toDriver(value) {
    if (value === null) return null;
    return new wkx.Point(
      value.lng,
      value.lat,
      undefined,
      undefined,
      4326,
    ).toEwkb();
  },
  fromDriver(value) {
    if (value === null) return null;
    let buf: Buffer;
    if (typeof value === "string") {
      buf = Buffer.from(value, "hex");
    } else if (Buffer.isBuffer(value)) {
      buf = value;
    } else {
      throw new Error(`Unexpected value type: ${typeof value}`);
    }
    const geom = wkx.Geometry.parse(buf);
    if (!(geom instanceof wkx.Point)) {
      throw new Error(`Expected Point, got ${geom.constructor.name}`);
    }
    return { lat: geom.y, lng: geom.x };
  },
});

export const lineString = customType<{ data: Point2[]; driverData: Buffer }>({
  dataType() {
    return "geometry(LineString,4326)";
  },
  toDriver: lineStringToDriver,
  fromDriver: lineStringFromDriver,
});

export function lineStringToDriver(value: Point2[]): Buffer {
  const line = new wkx.LineString(
    value.map(([lng, lat]) => new wkx.Point(lng, lat)),
    4326,
  );
  return line.toEwkb();
}

export function lineStringFromDriver(value: unknown): Point2[] {
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
}
