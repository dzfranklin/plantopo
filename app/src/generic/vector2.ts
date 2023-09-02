export function add2(
  a: [number, number],
  b: [number, number],
): [number, number] {
  return [a[0] + b[0], a[1] + b[1]];
}

export function sub2(
  a: [number, number],
  b: [number, number],
): [number, number] {
  return [a[0] - b[0], a[1] - b[1]];
}

export function magnitude2(a: [number, number]): number {
  return Math.sqrt(a[0] * a[0] + a[1] * a[1]);
}
