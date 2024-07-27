import { Tracker } from "./Tracker";
import { HookPath, SetterHook, Signal } from "./Signal";
import { Record } from "./Record";
import { Dispose } from "./Dispose";

export class EffectScope extends Dispose {
  static active: EffectScope | undefined;

  private effects: Set<Effect> = new Set();
  private signals: Set<Signal> = new Set();

  private pending: Set<Effect> = new Set();

  private collected = false;

  constructor() {
    super();
    Record.record(this);
    this.onDispose(this.cleanup.bind(this));
  }

  run<T>(fn: () => T) {
    const last_eff_scope = EffectScope.active;
    try {
      EffectScope.active = this;
      this.pending.clear();
      if (this.collected) return fn();
      return this.collect(fn);
    } finally {
      this.trigger();
      EffectScope.active = last_eff_scope;
    }
  }

  collect<T>(fn: () => T) {
    const unsubscribe = Record.subscribe((x) => {
      if (EffectScope.active !== this) return;
      if (x instanceof Signal) {
        this.signals.add(x);
      } else if (x instanceof Effect) {
        this.effects.add(x);
      }
    });
    try {
      return fn();
    } finally {
      this.collected = true;
      unsubscribe();
    }
  }

  fire(eff: Effect) {
    this.pending.add(eff);
  }

  private trigger() {
    const effs = Array.from(this.pending);
    const visited = new Set<Effect>();
    this.pending.clear();
    for (const eff of effs) {
      if (visited.has(eff)) return;
      eff.run();
      visited.add(eff);
      effs.push(...Array.from(this.pending));
      this.pending.clear();
    }
    this.pending.clear();
  }

  stop() {
    for (const eff of Array.from(this.effects)) {
      eff.stop();
    }
  }

  resume() {
    for (const eff of Array.from(this.effects)) {
      eff.enable();
    }
  }

  cleanup() {
    for (const sig of Array.from(this.signals)) {
      sig.cleanup();
    }
    this.signals.clear();
    for (const eff of this.effects) {
      eff.cleanup();
    }
    this.effects.clear();
  }
}

export enum EffectMode {
  Deep = "deep",
  Path = "path",
  Value = "value",
}
export type EffectOptions = {
  onTrigger?: (sig: Signal) => void;
  mode?: EffectMode;
};

export class Effect<T = any> extends Dispose {
  static active: Effect | undefined;

  private tracker = new Tracker(() => Effect.active === this);

  private triggers = new Map<Signal, (...args: any[]) => any>();

  enabled = true;

  private running = false;

  private listeners = new Set<(value: T) => void>();

  private subEffs = new Set<Effect>();
  private subSigs = new Set<Signal>();

  private mode = EffectMode.Path;

  private collected = false;

  constructor(public fn: () => T, private options?: EffectOptions) {
    super();
    this.mode = options?.mode ?? EffectMode.Path;
    Record.record(this);
    this.onDispose(this.cleanup.bind(this));
  }

  run() {
    if (this.running) return;
    const last_eff = Effect.active;
    if (!this.enabled) {
      return this.fn();
    }
    try {
      this.running = true;
      Effect.active = this;
      let ret: any;

      if (this.collected) {
        ret = this.fn();
      } else {
        ret = this.collect();
      }

      this.update();
      this.emit(ret);
      return ret as T;
    } finally {
      this.running = false;
      Effect.active = last_eff;
    }
  }

  collect() {
    const unsubscribe = Record.subscribe((x) => {
      if (Effect.active !== this) return;
      if (x instanceof Signal) {
        this.subSigs.add(x);
      } else if (x instanceof Effect) {
        this.subEffs.add(x);
      }
    });
    try {
      return this.tracker.collect(() => this.fn());
    } finally {
      this.collected = true;
      unsubscribe();
    }
  }

  private update() {
    Object.entries(this.tracker.dependencies).forEach(([id, paths]) => {
      const sig = Signal.signals.get(id);
      if (!sig) return;
      if (this.triggers.has(sig)) return;
      const match = (path: HookPath) => {
        switch (this.mode) {
          case EffectMode.Deep: {
            return true;
          }
          case EffectMode.Value: {
            return paths.has("value");
          }
          case EffectMode.Path: {
            return paths.has(path.map(String).join("."));
          }
        }
      };
      const cb: SetterHook = (v, sv, pth) => {
        if (!this.enabled) return;
        if (!match(pth)) return;

        if (EffectScope.active) {
          EffectScope.active.fire(this);
        } else {
          this.run();
        }

        this.options?.onTrigger?.(sig);
      };
      sig.subscribe({ setter: cb });
      this.triggers.set(sig, cb);
    });
  }

  get hygienic() {
    return this.triggers.size === 0;
  }

  private emit(value: T) {
    for (const listener of Array.from(this.listeners)) {
      try {
        listener(value);
      } catch (error) {
        console.error(error);
      }
    }
  }

  cleanup() {
    for (const [sig, cb] of Array.from(this.triggers.entries())) {
      sig.unsubscribe(cb);
    }
    for (const eff of this.subEffs) {
      eff.dispose();
    }
    for (const sig of this.subSigs) {
      sig.dispose();
    }
  }

  stop() {
    this.enabled = false;
  }

  enable() {
    this.enabled = true;
  }

  subscribe(listener: (value: T) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  unsubscribe(listener: (value: T) => void) {
    this.listeners.delete(listener);
  }
}

// const main = () => {
//   const todos = new Signal([
//     {
//       id: 1,
//       title: "todo 1",
//       done: true,
//     },
//     {
//       id: 2,
//       title: "todo 2",
//       done: false,
//     },
//   ]);

//   console.log(todos._id);

//   new Effect(
//     () => {
//       const task2 = todos.value[1];
//       console.log("task2.done: ", task2?.done);
//     },
//     {
//       onTrigger: (sig) => console.log("eff1", sig._id),
//     }
//   ).run();

//   new Effect(
//     () => {
//       console.log(todos.value);
//     },
//     {
//       onTrigger: (sig) => console.log("eff2", sig._id),
//     }
//   ).run();

//   todos.value[0].done = false;
//   todos.value[0].done = true;

//   todos.value[1].done = false;
//   todos.value[1].done = true;

//   todos.value.push({
//     id: 3,
//     title: "todo 3",
//     done: false,
//   });
// };

// main();
