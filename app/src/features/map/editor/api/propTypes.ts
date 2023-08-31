export type FracIdx = string;

export interface FPos {
  parent: number;
  idx: FracIdx;
}
export type FGeometry = GeoJSON.Geometry;

export type LOpacity = number | null;
export type LIdx = FracIdx | null;

export function isFPos(value: unknown): value is FPos {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record['parent'] === 'number' && typeof record['idx'] === 'string'
  );
}

export function isLOpacity(value: unknown): value is number {
  return typeof value === 'number' && value >= 0 && value <= 1;
}

export function isFGeometry(value: unknown): value is FGeometry {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  if (record['type'] === 'Point') {
    return isGeoJsonPosition(record['coordinates']);
  } else if (record['type'] === 'MultiPoint') {
    const coords = record['coordinates'];
    if (!Array.isArray(coords)) return false;
    for (const c of coords) {
      if (!isGeoJsonPosition(c)) return false;
    }
    return true;
  } else if (record['type'] === 'LineString') {
    const coords = record['coordinates'];
    if (!Array.isArray(coords)) return false;
    for (const c of coords) {
      if (!isGeoJsonPosition(c)) return false;
    }
    return true;
  } else if (record['type'] === 'MultiLineString') {
    const coords = record['coordinates'];
    if (!Array.isArray(coords)) return false;
    for (const c of coords) {
      if (!Array.isArray(c)) return false;
      for (const cc of c) {
        if (!isGeoJsonPosition(cc)) return false;
      }
    }
    return true;
  } else if (record['type'] === 'Polygon') {
    const coords = record['coordinates'];
    if (!Array.isArray(coords)) return false;
    for (const c of coords) {
      if (!Array.isArray(c)) return false;
      for (const cc of c) {
        if (!isGeoJsonPosition(cc)) return false;
      }
    }
    return true;
  } else if (record['type'] === 'MultiPolygon') {
    const coords = record['coordinates'];
    if (!Array.isArray(coords)) return false;
    for (const c of coords) {
      if (!Array.isArray(c)) return false;
      for (const cc of c) {
        if (!Array.isArray(cc)) return false;
        for (const ccc of cc) {
          if (!isGeoJsonPosition(ccc)) return false;
        }
      }
    }
    return true;
  } else if (record['type'] === 'GeometryCollection') {
    const geoms = record['geometries'];
    if (!Array.isArray(geoms)) return false;
    for (const g of geoms) {
      if (!isFGeometry(g)) return false;
    }
    return true;
  } else {
    return false;
  }
}

function isGeoJsonPosition(value: unknown): value is GeoJSON.Position {
  if (!Array.isArray(value)) return false;
  if (value.length !== 2 && value.length !== 3) return false;
  for (const v of value) {
    if (typeof v !== 'number') return false;
  }
  return true;
}
