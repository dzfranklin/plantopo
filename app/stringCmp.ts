export function stringCmp(a: string, b: string): -1 | 0 | 1 {
  if (a === b) return 0;
  if (a < b) return -1;
  return 1;
}
