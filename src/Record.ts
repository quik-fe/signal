export class Record {
  static cbs = new Set<(x: any) => void>();

  static subscribe(fn: (x: any) => void) {
    this.cbs.add(fn);
    return () => {
      this.cbs.delete(fn);
    };
  }

  static record(value: any) {
    this.cbs.forEach((cb) => cb(value));
  }
}
