import * as fc from 'fast-check';
import {
  fromBase10,
  serialize,
  deserialize,
  idxMid,
  idxCmp,
  toBase10,
  BEFORE_FIRST_IDX,
  AFTER_LAST_IDX,
} from './fracIdx';

const NUM_RUNS = 1_000;

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

const numerator = fc.oneof(
  { arbitrary: fc.bigUint(), weight: 95 },
  { arbitrary: fc.constant(0n), weight: 5 },
);

const denominator = fc.bigUint().filter((n) => n !== 0n);

const idx = fc.tuple(numerator, denominator).map(([n, d]) => serialize(n, d));

const log10 = (ctx, label, idx) => {
  ctx.log(`${label} base10: ${toBase10(idx)}`);
};

test('idxMid(0, 1)', () => {
  expect(idxMid(BEFORE_FIRST_IDX, AFTER_LAST_IDX)).toEqual(fromBase10('1/2'));
});

test('idxMid(0, 1/2)', () => {
  expect(idxMid(BEFORE_FIRST_IDX, fromBase10('1/2'))).toEqual(
    fromBase10('1/4'),
  );
});

test('idxMid(1/2, 1)', () => {
  expect(idxMid(fromBase10('1/2'), AFTER_LAST_IDX)).toEqual(fromBase10('3/4'));
});

test('idxMid(1/2, 1/3)', () => {
  expect(idxMid(fromBase10('1/2'), fromBase10('1/3'))).toEqual(
    fromBase10('5/12'),
  );
});

test('idxCmp(1/2, 1/2) throws', () => {
  expect(() => idxCmp(fromBase10('1/2'), fromBase10('1/2'))).toThrow();
});

test('idxMid(1/2, 1/2) == 1/2', () => {
  expect(idxMid(fromBase10('1/2'), fromBase10('1/2'))).toEqual(
    fromBase10('1/2'),
  );
});

test('insert many times', () => {
  let before = AFTER_LAST_IDX;
  for (let i = 0; i < 1_000; i++) {
    before = idxMid(BEFORE_FIRST_IDX, before);
  }

  let expected_d = 1n;
  for (let i = 0; i < 1_000; i++) {
    expected_d *= 2n;
  }

  expect(toBase10(before)).toEqual(`1/${expected_d}`);
});

test('idxMid(a, b) == idxMid(b, a)', () => {
  fc.assert(
    fc.property(idx, idx, fc.context(), (a, b, ctx) => {
      const actualAB = idxMid(a, b);
      const actualBA = idxMid(b, a);

      log10(ctx, 'a', a);
      log10(ctx, 'b', b);
      log10(ctx, 'actualAB', actualAB);
      log10(ctx, 'actualBA', actualBA);

      expect(actualAB).toEqual(actualBA);
    }),
    { numRuns: NUM_RUNS },
  );
});

test('idxCmp(a, b) is the inverse of idxCmp(b, a)', () => {
  fc.assert(
    fc.property(idx, idx, fc.context(), (a, b, ctx) => {
      fc.pre(a !== b);

      const actualAB = idxCmp(a, b);
      const actualBA = idxCmp(b, a);

      log10(ctx, 'a', a);
      log10(ctx, 'b', b);

      if (actualAB === 0) {
        expect(actualBA).toEqual(0);
      } else if (actualAB === -1) {
        expect(actualBA).toEqual(1);
      } else if (actualAB === 1) {
        expect(actualBA).toEqual(-1);
      } else {
        throw new Error('unreachable');
      }
    }),
    {
      numRuns: NUM_RUNS,
    },
  );
});

test('idxMid(a, b) is between a and b', () => {
  fc.assert(
    fc.property(idx, idx, fc.context(), (a, b, ctx) => {
      fc.pre(a != b);

      const actual = idxMid(a, b);

      log10(ctx, 'a', a);
      log10(ctx, 'b', b);
      log10(ctx, 'actual', actual);

      if (idxCmp(a, b) === 0) {
        expect(idxCmp(actual, a)).toEqual(0);
        expect(idxCmp(actual, b)).toEqual(0);
      } else if (idxCmp(a, b) === -1) {
        expect(idxCmp(a, actual)).toEqual(-1);
        expect(idxCmp(actual, b)).toEqual(-1);
      } else if (idxCmp(b, a) === -1) {
        expect(idxCmp(b, actual)).toEqual(-1);
        expect(idxCmp(actual, a)).toEqual(-1);
      } else {
        throw new Error('unreachable');
      }
    }),
    { numRuns: NUM_RUNS },
  );
});

test('deserialize(serialize(n, d)) == n, d', () => {
  fc.assert(
    fc.property(numerator, denominator, fc.context(), (n, d, ctx) => {
      const [actualN, actualD] = deserialize(serialize(n, d));
      ctx.log(`actualN: ${actualN}, actualD: ${actualD}`);
      actualN === n && actualD === d;
    }),
    { numRuns: NUM_RUNS },
  );
});
