import { Tacker } from "./Tacker";
import { Signal } from "./Signal";

export class EffectScope {
  static active: EffectScope | undefined;

  private effects: Set<Effect> = new Set();

  // 当前触发的 effects
  private trigger_effects: Set<Effect> = new Set();

  run<T>(fn: () => T) {
    const last_eff_scope = EffectScope.active;
    try {
      EffectScope.active = this;
      this.trigger_effects.clear();
      return fn();
    } finally {
      this.trigger();
      EffectScope.active = last_eff_scope;
    }
  }

  record_eff(eff: Effect) {
    this.effects.add(eff);
  }

  trigger_eff(eff: Effect) {
    this.trigger_effects.add(eff);
  }

  trigger() {
    const effs = Array.from(this.trigger_effects);
    const visited = new Set<Effect>();
    this.trigger_effects.clear();
    for (const eff of effs) {
      if (visited.has(eff)) return;
      eff.run();
      visited.add(eff);
      effs.push(...Array.from(this.trigger_effects));
      this.trigger_effects.clear();
    }
    this.trigger_effects.clear();
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
}

export class Effect<T = any> {
  static active: Effect | undefined;

  private collection = new Tacker();

  private triggers = new Map<Signal, (...args: any[]) => any>();

  enabled = true;

  private running = false;

  private listeners = new Set<(value: T) => void>();

  constructor(
    public fn: () => T,
    private options?: {
      onTrigger?: (sig: Signal) => void;
    }
  ) {
    EffectScope.active?.record_eff(this);
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
      const ret = this.collection.collect(() => this.fn());
      this.update_triggers();
      this.emit_value(ret);
      return ret;
    } finally {
      this.running = false;
      Effect.active = last_eff;
    }
  }

  private update_triggers() {
    this.collection.dependencies.forEach((sig) => {
      if (this.triggers.has(sig)) return;
      const cb = () => {
        if (EffectScope.active) {
          EffectScope.active.trigger_eff(this);
        } else {
          this.run();
        }

        this.options?.onTrigger?.(sig);
      };
      sig.subscribe({ setter: cb });
      this.triggers.set(sig, cb);
    });
  }

  private emit_value(value: T) {
    for (const listener of Array.from(this.listeners)) {
      listener(value);
    }
  }

  cleanup() {
    for (const [sig, cb] of Array.from(this.triggers.entries())) {
      sig.unsubscribe(cb);
    }
  }

  stop() {
    if (!this.enabled) return;
    this.enabled = false;
  }

  enable() {
    if (this.enabled) return;
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

export class EffectSignal<T> {
  private _sig: Signal<T>;
  private _value: T;
  private _eff: Effect;

  unsubscribe: () => void;

  constructor(memoFn: () => T) {
    this._eff = new Effect(memoFn);
    this._value = this._eff.run();
    this._sig = new Signal(this._value);
    this.unsubscribe = this._eff.subscribe((val) => {
      this._value = val;
      this._sig.value = val;
    });
  }

  get _id() {
    return this._sig._id;
  }

  get value() {
    return this._sig.value;
  }

  get signal() {
    return this._sig;
  }

  cleanup() {
    this._eff.cleanup();
    this._sig.cleanup();
    this.unsubscribe();
  }
}

// const main = () => {
//   const sig1 = new Signal(1);
//   const sig2 = new EffectSignal(() => sig1.value * 2);

//   console.log(sig1._id);
//   console.log(sig2._id);

//   const eff = new Effect(
//     () => {
//       console.log(sig2.value);
//     },
//     {
//       onTrigger: (sig) => console.log(sig._id),
//     }
//   );
//   eff.run();

//   sig1.value += 1;
//   sig1.value += 1;
//   sig1.value += 1;
//   sig1.value += 1;

//   console.log(sig1.value);
// };

// main();

// new EffectScope().run(main);
