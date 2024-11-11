export function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

export function pythagoreanDist(
  a: [number, number],
  b: [number, number],
): number {
  const x = b[0] - a[0];
  const y = b[1] - a[1];
  return Math.sqrt(x * x + y * y);
}
