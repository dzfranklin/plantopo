export function fracIdxCompare(a: string, b: string): -1 | 0 | 1 {
  const aN = toN(a);
  const bN = toN(b);
  if (aN > bN) {
    return 1;
  } else if (aN < bN) {
    return -1;
  } else {
    return 0;
  }
}

// TODO: What if a == b?
// We may need to make on_update smarter so it can patch this. or ideally this'd
// be done in protocol so we could change what we receive instead of firing off
// another, maybe?

// TODO We need two bigints for a rational!

export function fracIdxBetween(a: string, b: string): string {
  const aN = toN(a);
  const bN = toN(b);
  return toS((aN + bN) / 2n);
}

const toN = (v: string) => BigInt('0x' + v);
const toS = (n: bigint) => n.toString(16);
