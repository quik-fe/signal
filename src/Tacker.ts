import { Signal } from "./Signal";

export class Tacker {
  static tracking = true;
  static tracking_stack = [] as boolean[];

  static pause() {
    Tacker.tracking_stack.push(Tacker.tracking);
    Tacker.tracking = false;
  }

  static enable() {
    Tacker.tracking_stack.push(Tacker.tracking);
    Tacker.tracking = true;
  }

  static resume() {
    Tacker.tracking = Tacker.tracking_stack.pop() ?? true;
  }

  static skip<T>(fn: () => T) {
    Tacker.pause();
    try {
      return fn();
    } finally {
      Tacker.resume();
    }
  }

  dependencies: Set<Signal<any>> = new Set();
  dependents: Set<Signal<any>> = new Set();

  /**
   * A function that collects dependencies and dependents based on the provided function.
   *
   * @param {() => T} fn - The function to be executed for collecting dependencies and dependents.
   * @return {T} The result of executing the provided function.
   */
  collect<T>(fn: () => T) {
    if (!Tacker.tracking) {
      return fn();
    }
    const unsubscribe = Signal.subscribe({
      getter: (value, path, sig) => {
        if (!Tacker.tracking) return;
        this.dependencies.add(sig);
      },
      setter: (value, setValue, path, sig) => {
        if (!Tacker.tracking) return;
        this.dependents.add(sig);
      },
    });
    try {
      return fn();
    } finally {
      unsubscribe();
    }
  }
}
