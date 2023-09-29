export interface CameraURLParam {
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
}

export function parseCameraURLParam(param: string): CameraURLParam | undefined {
  if (param === '') {
    return undefined;
  }
  try {
    return _tryParseCameraURLParam(param);
  } catch (e) {
    console.error('failed to parse camera url param', e);
    return undefined;
  }
}

function _tryParseCameraURLParam(param: string): CameraURLParam {
  const topLevel = param.split('@');
  if (topLevel.length !== 2) throw new Error('invalid top level');
  const center = topLevel[0]!;
  const rest = topLevel[1]!;

  const centerParts = center.split(',');
  if (centerParts.length !== 2) throw new Error('invalid center');
  const lng = myParseFloat(centerParts[0]!);
  const lat = myParseFloat(centerParts[1]!);

  const restParts = rest.split(',');
  if (restParts.length !== 3) throw new Error('invalid rest');
  const zoom = myParseFloat(restParts[0]!);
  const bearing = myParseFloat(restParts[1]!);
  const pitch = myParseFloat(restParts[2]!);

  return {
    center: [lng, lat],
    zoom,
    bearing,
    pitch,
  };
}

export function serializeCameraURLParam(value: CameraURLParam): string {
  const lng = serializeFloat(value.center[0], 7);
  const lat = serializeFloat(value.center[1], 7);
  const zoom = serializeFloat(value.zoom, 2);
  const bearing = serializeFloat(value.bearing, 2);
  const pitch = serializeFloat(value.pitch, 2);
  return `${lng},${lat}@${zoom},${bearing},${pitch}`;
}

function serializeFloat(value: number, factionDigits: number): string {
  let v = value.toFixed(factionDigits);
  while (v.endsWith('0')) {
    v = v.slice(0, -1);
  }
  if (v.endsWith('.')) {
    v = v.slice(0, -1);
  }
  return v;
}

function myParseFloat(value: string): number {
  const out = parseFloat(value);
  if (isNaN(out)) {
    throw new Error(`invalid number ${value}`);
  }
  return out;
}
