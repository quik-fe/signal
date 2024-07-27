import { EffectSignal, MemoFn } from "./EffSignal";
import { Effect, EffectOptions, EffectScope } from "./Effect";
import {
  HookSignal,
  HookSignalFn,
  ShallowSignal,
  Signal,
  SignalOptions,
} from "./Signal";
import { Tracker } from "./Tracker";
import { WatchEffect } from "./WatchEffect";

export function createEffect<T = any>(
  fn: () => T,
  options?: {
    lazy?: boolean;
  } & EffectOptions
): Effect<T> {
  const eff = new Effect(fn, options);
  if (!options?.lazy) eff.run();
  return eff;
}

export function createWatchEffect<T = any>(
  watch: () => T,
  fn: (value: T, oldValue: T | undefined) => void,
  options?: {
    lazy?: boolean;
  } & EffectOptions
): WatchEffect<T> {
  const eff = new WatchEffect(watch, fn, options);
  if (!options?.lazy) eff.run();
  return eff;
}

type SignalX<T> = Signal<T> & [() => T, (newValue: T) => void];

export function createSignal<T>(value: T, options?: SignalOptions): SignalX<T>;
export function createSignal<T>(): SignalX<T | undefined>;
export function createSignal(): SignalX<any>;
export function createSignal(
  value?: any,
  options?: SignalOptions
): SignalX<any> {
  const signal = new Signal(value, options);
  return signal as any;
}

export function batch<T, ARGS extends any[]>(
  fn: (...args: ARGS) => T,
  ...args: ARGS
) {
  const scope = new EffectScope();
  try {
    return scope.run(fn, ...args);
  } finally {
    scope.dispose();
  }
}

export function createEffectSignal<T>(memoFn: MemoFn<T>) {
  return new EffectSignal<T>(memoFn);
}
export function skip<T, ARGS extends any[]>(
  fn: (...args: ARGS) => T,
  ...args: ARGS
): T {
  try {
    Tracker.pause();
    return fn(...args);
  } finally {
    Tracker.resume();
  }
}
export function topRun<T>(fn: () => T): T {
  const activeEff = Effect.active;
  const activeScope = EffectScope.active;
  try {
    Effect.active = undefined;
    EffectScope.active = undefined;
    return fn();
  } finally {
    EffectScope.active = activeScope;
    Effect.active = activeEff;
  }
}
export function unref<T>(sig: T): T extends Signal<infer P> ? P : T {
  return sig instanceof Signal ? sig.value : sig;
}
export function untrack<T>(fn: () => T): T extends Signal<infer P> ? P : T {
  return skip(() => unref(fn()));
}
export function isRef(sig: any): sig is Signal {
  return sig instanceof Signal;
}
type RefOptions = {
  shallow?: boolean;
};
export function toRef<T>(
  sig: T,
  options?: RefOptions
): T extends Signal ? T : Signal<T>;

export function toRef<T>(
  sig: HookSignalFn<T>,
  options?: RefOptions
): HookSignal<T>;
export function toRef<T>(
  sig: { get(): T; set(value: T): void },
  options?: RefOptions
): HookSignal<T>;
export function toRef<T>(
  sig: T,
  options?: RefOptions
): T extends Signal ? T : Signal<T>;
export function toRef(sig: any, options: RefOptions = {}) {
  if (
    sig &&
    typeof sig === "object" &&
    typeof sig.get === "function" &&
    typeof sig.set === "function"
  )
    return new HookSignal((track, trigger) => {
      return {
        get() {
          track();
          return sig.get();
        },
        set(value) {
          trigger();
          sig.set(value);
        },
      };
    });
  if (typeof sig === "function") {
    return new HookSignal(sig);
  }
  if (options.shallow) {
    return new ShallowSignal(unref(sig));
  }
  return sig instanceof Signal ? sig : new Signal(sig);
}
type Refs<T> = { [K in keyof T]: T[K] extends HookSignal<infer P> ? P : T[K] };
export function toRefs<T extends object>(sig: Signal<T>): Refs<T>;
export function toRefs(sig: any) {
  return Object.fromEntries(
    Object.entries(sig.value).map(([k, v]) => [
      k,
      toRef({
        get: () => sig.value[k],
        set: (value) => {
          sig.value[k] = value;
        },
      }),
    ])
  );
}
type Reactive<T = {}> = T & {
  __sig__: Signal<T>;
};

export function toReactive<T extends object>(init: Signal<T>): Reactive<T>;
export function toReactive<T extends object>(init: T): Reactive<T>;
export function toReactive(init: any) {
  const sig = init instanceof Signal ? init : new Signal(init);
  return new Proxy(init, {
    get(target, key) {
      if (key === "__sig__") return sig;
      return Reflect.get(sig.value, key);
    },
    set(target, key, value) {
      return Reflect.set(sig.value, key, value);
    },
    has(target, p) {
      if (p === "__sig__") return true;
      return Reflect.has(sig.value, p);
    },
  });
}
export function isReactive<T>(obj: T): obj is Reactive<T> {
  return (
    obj &&
    typeof obj === "object" &&
    "__sig__" in obj &&
    obj.__sig__ instanceof Signal
  );
}
isReactive({} as any);

type MaybeRefOrGetter<T> = T | (() => T) | Signal<T>;

export function toValue<T>(sig: MaybeRefOrGetter<T>): T;
export function toValue(sig: any) {
  if (sig instanceof Signal) return sig.value;
  if (typeof sig === "function") return sig();
  return sig;
}

export function toMemo<T>(sig: MaybeRefOrGetter<T>): EffectSignal<T>;
export function toMemo(sig: any) {
  return new EffectSignal(() => toValue(sig));
}

export function toRaw<T extends WeakKey>(o: T): T {
  return Signal.toRaw(o);
}

export function trigger(x: any) {
  if (x instanceof Signal) return x.trigger();
  if (isReactive(x)) return x.__sig__.trigger();
  return x;
}
export function getScope() {
  return EffectScope.active;
}
export function getEffect() {
  return Effect.active;
}
