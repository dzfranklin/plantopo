export interface IEngineLocalPersistence {
  load(key: string): Promise<unknown>;
  saveWhenIdle(key: string, value: unknown): Promise<void>;
}

export class EngineLocalPersistence implements IEngineLocalPersistence {
  constructor(public mapId: number) {}

  private _pending = new Map<string, { handle: number; value: unknown }>();

  async load(key: string): Promise<unknown> {
    const pending = this._pending.get(key);
    if (pending) {
      return pending.value;
    }

    const serialized = localStorage.getItem(this._key(key));
    if (serialized === null || serialized === '') {
      return undefined;
    }
    try {
      return JSON.parse(serialized);
    } catch (err) {
      // Don't break the client forever because something invalid is stored
      console.error(err);
      return undefined;
    }
  }

  async saveWhenIdle(key: string, value: unknown): Promise<void> {
    const pending = this._pending.get(key);
    if (pending) {
      cancelIdleCallback(pending.handle);
    }

    const handle = requestIdleCallback(
      () => {
        localStorage.setItem(this._key(key), JSON.stringify(value));
      },
      { timeout: 5000 },
    );
    this._pending.set(key, { handle, value });
  }

  private _key(key: string): string {
    return `engine-${this.mapId}-${key}`;
  }
}
