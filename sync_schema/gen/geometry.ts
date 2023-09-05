type Geometry = PointGeometry | LineStringGeometry;
type PointGeometry = { type: "Point"; coordinates: [number, number] };
type LineStringGeometry = {
  type: "LineString";
  coordinates: [number, number][];
};
