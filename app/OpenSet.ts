/**
 * Based on https://github.com/mourner/tinyqueue
 * Copyright (c) 2017, Vladimir Agafonkin https://github.com/mourner/tinyqueue/blob/master/LICENSE (ISC)
 */
import { HighwaySegment } from '@/features/map/snap/HighwayGraph';
import DefaultMap from '@/DefaultMap';

export default class OpenSet {
  private _set = new Set<HighwaySegment>();
  private _data: HighwaySegment[] = [];
  private _size = 0;
  private _fScore: DefaultMap<number, number>;

  constructor(fScore: DefaultMap<number, number>) {
    this._fScore = fScore;
  }

  get size(): number {
    return this._size;
  }

  has(item: HighwaySegment): boolean {
    return this._set.has(item);
  }

  push(item: HighwaySegment) {
    this._set.add(item);
    this._data.push(item);
    this._up(this._size++);
  }

  pop(): HighwaySegment | undefined {
    if (this._size === 0) return undefined;

    const top = this._data[0]!;
    const bottom = this._data.pop()!;

    if (--this._size > 0) {
      this._data[0] = bottom;
      this._down(0);
    }

    this._set.delete(top);
    return top;
  }

  _up(pos: number) {
    const item = this._data[pos]!;

    while (pos > 0) {
      const parent = (pos - 1) >> 1;
      const current = this._data[parent]!;
      if (this._cmp(item, current) >= 0) break;
      this._data[pos] = current;
      pos = parent;
    }

    this._data[pos] = item;
  }

  _down(pos: number) {
    const halfLength = this._size >> 1;
    const item = this._data[pos]!;

    while (pos < halfLength) {
      let bestChild = (pos << 1) + 1; // initially it is the left child
      const right = bestChild + 1;

      if (
        right < this._size &&
        this._cmp(this._data[right]!, this._data[bestChild]!) < 0
      ) {
        bestChild = right;
      }
      if (this._cmp(this._data[bestChild]!, item) >= 0) break;

      this._data[pos] = this._data[bestChild]!;
      pos = bestChild;
    }

    this._data[pos] = item;
  }

  private _cmp(a: HighwaySegment, b: HighwaySegment): number {
    return this._fScore.get(a.id) - this._fScore.get(b.id);
  }
}
