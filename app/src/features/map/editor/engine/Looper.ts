export interface Looper {
  do?: () => any;
  start(): void;
  destroy(): void;
}

export class TimedLooper implements Looper {
  public do?: () => any;

  private _intervalMs: number;
  private _interval?: number;
  private _destroyed = false;

  constructor(intervalMs: number) {
    this._intervalMs = intervalMs;
  }

  start() {
    this._interval = window.setInterval(() => {
      if (this._destroyed) return;
      this.do?.();
    }, this._intervalMs);
  }

  destroy() {
    this._destroyed = true;
    window.clearInterval(this._interval);
  }
}
