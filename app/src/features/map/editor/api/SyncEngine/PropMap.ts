export class Props {
  /** Current value, must be valid */
  private _values = new Map<string, unknown>();
  /** If we have a more recent value than the current but it is invalid */
  private _invalid = new Map<string, unknown>();

  get(key: string): unknown | null {
    return this._values.get(key) ?? null;
  }

  set(key: string, value: unknown): void {
    this._values.set(key, value);
    this._invalid.delete(key);
  }

  setInvalid(key: string, value: unknown): void {
    this._invalid.set(key, value);
  }
}

export class PropMap {
  _props = new Map<number, Props>();

  delete(id: number): void {
    this._props.delete(id);
  }

  *[Symbol.iterator](): IterableIterator<[number, Props]> {
    yield* this._props.entries();
  }

  *values(): IterableIterator<Props> {
    yield* this._props.values();
  }

  props(id: number): Props | null {
    return this._props.get(id) ?? null;
  }

  propsOrInit(id: number): Props {
    let props = this.props(id);
    if (!props) {
      props = new Props();
      this._props.set(id, props);
    }
    return props;
  }
}
