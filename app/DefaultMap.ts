export default class DefaultMap<K, V> {
  private _m = new Map<K, V>();

  private _defaultFactory: () => V;

  private constructor(defaultFactory: () => V) {
    this._defaultFactory = defaultFactory;
  }

  static of<K, V>(defaultValue: V): DefaultMap<K, V> {
    return new DefaultMap<K, V>(() => defaultValue);
  }

  static with<K, V>(defaultFactory: () => V): DefaultMap<K, V> {
    return new DefaultMap<K, V>(defaultFactory);
  }

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
      const v = this._defaultFactory();
      this._m.set(key, v);
      return v;
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
