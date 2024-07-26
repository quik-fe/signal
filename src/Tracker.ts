import { HookPath, Signal } from "./Signal";

export class Tracker {
  static tracking = true;
  static tracking_stack = [] as boolean[];

  static pause() {
    Tracker.tracking_stack.push(Tracker.tracking);
    Tracker.tracking = false;
  }

  static enable() {
    Tracker.tracking_stack.push(Tracker.tracking);
    Tracker.tracking = true;
  }

  static resume() {
    Tracker.tracking = Tracker.tracking_stack.pop() ?? true;
  }

  static skip<T>(fn: () => T) {
    Tracker.pause();
    try {
      return fn();
    } finally {
      Tracker.resume();
    }
  }

  dependencies = {} as Record<string, HookPath[]>;
  dependents = {} as Record<string, HookPath[]>;

  constructor(private enabled?: () => boolean) {}

  /**
   * A function that collects dependencies and dependents based on the provided function.
   *
   * @param {() => T} fn - The function to be executed for collecting dependencies and dependents.
   * @return {T} The result of executing the provided function.
   */
  collect<T>(fn: () => T) {
    if (!Tracker.tracking) {
      return fn();
    }
    const unsubscribe = Signal.subscribe({
      getter: (value, path, sig) => {
        if (!Tracker.tracking) return;
        if (this.enabled && !this.enabled()) return;
        this.dependencies[sig._id] ||= [];
        this.dependencies[sig._id].push(path);
      },
      setter: (value, setValue, path, sig) => {
        if (!Tracker.tracking) return;
        if (this.enabled && !this.enabled()) return;
        this.dependents[sig._id] ||= [];
        this.dependents[sig._id].push(path);
      },
    });
    try {
      return fn();
    } finally {
      unsubscribe();
    }
  }
}
