export class Dispose {
  private _abort = new AbortController();

  dispose() {
    this._abort.abort();
  }

  onDispose(fn: () => void) {
    this._abort.signal.addEventListener("abort", fn);
  }
}
