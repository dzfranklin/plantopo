export type UnitSystem = 'metric' | 'customary';

export function formatDuration(seconds: number): [string, string] {
  if (seconds < 60) {
    return [String(seconds), 's'];
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return [`${minutes}:${String(remainingSeconds).padStart(2, '0')}`, 'm'];
  } else {
    const hours = Math.floor(seconds / 3600);
    const remainingMinutes = Math.floor((seconds % 3600) / 60);
    return [`${hours}:${String(remainingMinutes).padStart(2, '0')}`, 'h'];
  }
}

export function formatDateTime(date: Date): string {
  return date.toLocaleString(getLang(), {});
}

export function formatDistance(
  meters: number,
  unit?: UnitSystem,
): [string, string] {
  const value = distanceInUnit(meters, unit);
  const label = distanceUnitLabel(unit);
  return [formatUnitless(value, 2), label];
}

export function distanceInUnit(meters: number, unit?: UnitSystem): number {
  if (resolveUnit(unit) === 'metric') {
    return meters / 1000;
  } else {
    return meters / 1609.344;
  }
}

export function distanceUnitLabel(unit?: UnitSystem): string {
  if (resolveUnit(unit) === 'metric') {
    return 'km';
  } else {
    return 'mi';
  }
}

export function formatElevation(
  meters: number,
  unit?: UnitSystem,
): [string, string] {
  const value = elevationInUnit(meters, unit);
  const label = elevationUnitLabel(unit);
  return [formatUnitless(value, 0), label];
}

export function elevationInUnit(meters: number, unit?: UnitSystem): number {
  if (resolveUnit(unit) === 'metric') {
    return meters;
  } else {
    return meters * 3.28083989501;
  }
}

export function elevationUnitLabel(unit?: UnitSystem): string {
  if (resolveUnit(unit) === 'metric') {
    return 'm';
  } else {
    return 'ft';
  }
}

export function formatUnitless(value: number, places: number): string {
  return value.toLocaleString(getLang(), { maximumFractionDigits: places });
}

function getLang() {
  if (navigator.languages != undefined) return navigator.languages[0];
  return navigator.language;
}

function resolveUnit(s: UnitSystem | undefined): UnitSystem {
  if (s) return s;
  return 'metric';
}
