// Returns [start, end)
export function range(start: number, end: number): number[] {
  const len = end - start;
  if (len < 0) return [];
  return Array(len)
    .fill(0)
    .map((_, i) => start + i);
}
