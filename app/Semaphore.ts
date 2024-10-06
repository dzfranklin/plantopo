export class Semaphore {
  private _q: Array<(_: void) => void> = [];
  private _used = 0;

  constructor(public readonly limit: number) {}

  acquire() {
    if (this._used < this.limit) {
      this._used++;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this._q.push(resolve);
    });
  }

  release() {
    const head = this._q.shift();
    if (head) {
      head();
    } else {
      this._used -= 1;
    }
  }

  use<T>(fn: () => Promise<T>): Promise<T> {
    return this.acquire()
      .then(fn)
      .then(
        (val) => {
          this.release();
          return val;
        },
        (err) => {
          this.release();
          throw err;
        },
      );
  }
}
