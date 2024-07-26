export class Dispose {
  private _abort = new AbortController();

  static nextTick(fn: () => void) {
    setTimeout(fn, 0);
  }

  dispose() {
    Dispose.nextTick(() => {
      this._abort.abort();
    });
  }

  onDispose(fn: () => void) {
    this._abort.signal.addEventListener("abort", fn);
  }
}
