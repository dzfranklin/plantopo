// Returns [start, end)
export function range(start: number, end: number): number[] {
  const len = end - start;
  if (len < 0) return [];
  return Array(len)
    .fill(0)
    .map((_, i) => start + i);
}

export function shallowArrayEqual(a: unknown[], b: unknown[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < b.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
