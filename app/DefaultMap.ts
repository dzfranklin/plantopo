export default class DefaultMap<K, V> {
  private _m = new Map<K, V>();

  constructor(public readonly defaultValue: V) {}

  clear() {
    this._m.clear();
  }

  delete(key: K) {
    this._m.delete(key);
  }

  get(key: K): V {
    if (this._m.has(key)) {
      return this._m.get(key)!;
    } else {
      return this.defaultValue;
    }
  }

  has(key: K) {
    return this._m.has(key);
  }

  set(key: K, value: V) {
    this._m.set(key, value);
  }

  [Symbol.iterator]() {
    return this._m[Symbol.iterator]();
  }
}
