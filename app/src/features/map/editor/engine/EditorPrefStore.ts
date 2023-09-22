export class EditorPrefStore {
  sidebarWidth(): number | undefined {
    return this._get('sidebarWidth', Number);
  }

  setSidebarWidth(width: number): void {
    this._set('sidebarWidth', String(width));
  }

  private _get<T>(key: string, trans: (raw: string) => T): T | undefined {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      return trans(raw);
    }
  }

  private _set(key: string, value: string): void {
    localStorage.setItem(key, value);
  }
}
