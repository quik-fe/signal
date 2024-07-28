import { Signal } from "./Signal";

export class Tracker {
  dependencies = {} as Record<string, Set<string>>;
  dependents = {} as Record<string, Set<string>>;

  constructor(private enabled?: () => boolean) {}

  /**
   * A function that collects dependencies and dependents based on the provided function.
   *
   * @param {() => T} fn - The function to be executed for collecting dependencies and dependents.
   * @return {T} The result of executing the provided function.
   */
  collect<T>(fn: () => T) {
    if (!Signal.tracking) {
      return fn();
    }
    const unsubscribe = Signal.subscribe({
      getter: (value, path, sig) => {
        if (!Signal.tracking) return;
        if (this.enabled && !this.enabled()) return;
        this.dependencies[sig._id] ||= new Set();
        this.dependencies[sig._id].add(path.map(String).join("."));
      },
      setter: (value, setValue, path, sig) => {
        if (!Signal.tracking) return;
        if (this.enabled && !this.enabled()) return;
        this.dependents[sig._id] ||= new Set();
        this.dependents[sig._id].add(path.map(String).join("."));
      },
    });
    try {
      return fn();
    } finally {
      unsubscribe();
    }
  }
}
