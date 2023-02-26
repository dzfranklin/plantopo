// See <https://madebyevan.com/algos/crdt-fractional-indexing/>
// <https://jrsinclair.com/articles/2020/sick-of-the-jokes-write-your-own-arbitrary-precision-javascript-math-library/>

// prettier-ignore
const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!#$%&()*+,-.:;<=>?@[]^_{|}~'.split('');
const RADIX = BigInt(ALPHABET.length);

export const BEFORE_FIRST_IDX = fromBase10('0/1');
export const AFTER_LAST_IDX = fromBase10('1/1');

// TODO: Add jitter

export function idxMid(a: string, b: string): string {
  if (a === b) {
    console.warn('idxMid: a and b are the same');
    return a;
  }

  const [an, ad] = deserialize(a);
  const [bn, bd] = deserialize(b);

  return serialize(an * bd + bn * ad, ad * bd * 2n);
}

// Callers are responsible for checking if a === b and dealing with it
// appropriately (i.e. break tie with id).
export function idxCmp(a: string, b: string): number {
  const [an, ad] = deserialize(a);
  const [bn, bd] = deserialize(b);

  if (an === bn && ad == bd) {
    throw new Error('idxCmp: same value');
  } else if (an * bd < bn * ad) {
    return -1;
  } else {
    return 1;
  }
}

export function toBase10(x: string): string {
  const [n, d] = deserialize(x);
  return n.toString() + '/' + d.toString();
}

export function fromBase10(v: string): string {
  const [n, d] = v.split('/');
  return serialize(BigInt(n), BigInt(d));
}

export function deserialize(v: string): [bigint, bigint] {
  const [n, d] = v.split('/');
  return [deserializeBigint(n), deserializeBigint(d)];
}

export function serialize(n: bigint, d: bigint): string {
  const f = gcd(n, d);
  const sn = n / f;
  const sd = d / f;
  return serializeBigint(sn) + '/' + serializeBigint(sd);
}

function gcd(a: bigint, b: bigint): bigint {
  if (a === 0n && b === 0n) {
    return 1n;
  }
  if (a === 0n) {
    return b;
  }
  if (b === 0n) {
    return a;
  }

  let t: bigint;
  while (b !== 0n) {
    t = b;
    b = a % b;
    a = t;
  }
  return a;
}

function deserializeBigint(v: string): bigint {
  let x = 0n;
  for (let idx = 0; idx < v.length; idx++) {
    const n = ALPHABET.indexOf(v[idx]);
    if (n === -1) throw new Error(`parseN: invalid character in: ${v}`);
    x += BigInt(n) * pow(RADIX, idx);
  }
  return x;
}

function serializeBigint(n: bigint): string {
  if (n < 0n) throw new Error('serializeN: negative n');
  const digits: string[] = [];
  do {
    const q = n % RADIX;
    digits.push(ALPHABET[q.toString()]);
    n /= RADIX;
  } while (n != 0n);
  return digits.join('');
}

function pow(base: bigint, exp: number): bigint {
  let x = 1n;
  for (let i = 0; i < exp; i++) {
    x *= base;
  }
  return x;
}
