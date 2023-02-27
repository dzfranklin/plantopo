import * as fc from 'fast-check';
import { idxBetween } from './fracIdx';

const NUM_RUNS = 1_000;

const MIN = 0x23;
const MAX = 0x73;

const idx = fc
  .array(fc.integer({ min: MIN, max: MAX }))
  .map((v) => v.map((d) => String.fromCharCode(d)).join(''));

test('insert many times works', () => {
  let after = '';
  for (let i = 0; i < 500; i++) {
    after = idxBetween('', after);
  }
});

test('insert between ends', () => {
  expect(idxBetween('', '')).toMatch(/Q+/);
});

test('idxBetween(a, b) is between a and b', () => {
  fc.assert(
    fc.property(idx, idx, fc.context(), (before, after, ctx) => {
      fc.pre(thereIsSomethingBetween(before, after));

      const between = idxBetween(before, after);
      ctx.log(`before=${before} after=${after} between=${between}`);

      // In the sort order we should sort after `before`
      expect(between > before).toBe(true);
      // In the sort order we should sort before `after`
      expect(between < after).toBe(true);
    }),
    { numRuns: NUM_RUNS },
  );
});

function thereIsSomethingBetween(before: string, after: string): boolean {
  if (!(before < after)) return false;
  if (after.startsWith(before)) {
    // Nothing between foo and foo000000000000
    return !!after.slice(before.length).match(`[^${String.fromCharCode(MIN)}]`);
  }
  return true;
}
