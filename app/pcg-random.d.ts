declare module 'pcg-random' {
  export default class PcgRandom {
    constructor(seedLo32: number, seedHi32: number = 0);

    /**
     * Get a uniformly distributed 32 bit integer between 0 (inclusive) and a specified value (exclusive).
     *
     * If the maximum value isn't specified, the function will return a uniformly distributed 32 bit integer (equivalent to PcgRandom.prototype.next32()).
     */
    integer(max?: number): number;

    /**
     * Get a uniformly distributed IEEE-754 binary64 between 0.0 and 1.0.
     *
     * This is essentially equivalent to Math.random().
     */
    number(): number;
  }
}
