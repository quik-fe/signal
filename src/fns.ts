import { EffectSignal, MemoFn } from "./EffSignal";
import { Effect, EffectScope } from "./Effect";
import { Signal, SignalOptions } from "./Signal";

export function createEffect<T = any>(
  fn: () => T,
  options?: {
    lazy?: boolean;
  }
): Effect<T> {
  const eff = new Effect(fn);
  if (!options?.lazy) eff.run();
  return eff;
}

export function createSignal<T>(value: T, options?: SignalOptions): Signal<T>;
export function createSignal<T>(): Signal<T | undefined>;
export function createSignal(): Signal<any>;
export function createSignal(
  value?: any,
  options?: SignalOptions
): Signal<any> {
  const signal = new Signal(value, options);
  return signal;
}

export function createEffectScope<T>(fn: () => T) {
  return new EffectScope().run(fn);
}

export function createEffectSignal<T>(memoFn: MemoFn<T>) {
  return new EffectSignal<T>(memoFn);
}
