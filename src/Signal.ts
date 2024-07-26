import { Dispose } from "./Dispose";
import { Record } from "./Record";

function isObject<T>(obj: T): obj is T & object {
  return typeof obj === "object" && obj !== null;
}
export type HookPath = (string | symbol)[];
export type GetterHook = (value: any, path: HookPath, sig: Signal<any>) => void;
export type SetterHook = (
  value: any,
  setValue: any,
  path: HookPath,
  sig: Signal<any>
) => void;

export type SignalOptions = {
  deep?: boolean;
  onGet?: GetterHook;
  onSet?: SetterHook;
};

const VALUE = Symbol("Signal.value");

export class Signal<T = any> extends Dispose {
  static VALUE = VALUE;

  static proxy2raw = new WeakMap();
  static raw2proxy = new WeakMap();

  static get_hooks = new Set<GetterHook>();
  static set_hooks = new Set<SetterHook>();

  static signals = new Map<string, Signal>();

  /**
   * Subscribes to changes in the signal by adding getter and setter hooks.
   *
   * @param {GetterHook} getter - Optional getter hook function.
   * @param {SetterHook} setter - Optional setter hook function.
   * @return {Function} Function to unsubscribe from the signal.
   */
  static subscribe({
    getter,
    setter,
    once,
  }: {
    getter?: GetterHook;
    setter?: SetterHook;
    once?: boolean;
  }) {
    const unsubscribe = () => {
      if (getter) this.get_hooks.delete(getter);
      if (setter) this.set_hooks.delete(setter);
    };

    if (getter)
      this.get_hooks.add((...args) => {
        getter(...args);
        if (once) unsubscribe();
      });
    if (setter)
      this.set_hooks.add((...args) => {
        setter(...args);
        if (once) unsubscribe();
      });

    return unsubscribe;
  }

  /**
   * Checks if the given object is an instance of the Signal class.
   *
   * @param {any} obj - The object to check.
   * @return {obj is Signal<any>} Returns true if the object is an instance of the Signal class, false otherwise.
   */
  static isSignal(obj: any): obj is Signal<any> {
    return isObject(obj) && obj instanceof Signal;
  }

  /**
   * Checks if the given object is a proxy.
   *
   * @param {any} obj - The object to check.
   * @return {boolean} Returns true if the object is a proxy, false otherwise.
   */
  static isProxy(obj: any) {
    return this.proxy2raw.has(obj);
  }

  /**
   * Retrieves the raw value of a given proxy.
   *
   * @param {T extends WeakKey} proxy - The proxy object.
   * @return {T} The raw value of the proxy.
   */
  static toRaw<T extends WeakKey>(proxy: T): T {
    return this.proxy2raw.get(proxy) ?? proxy;
  }

  /**
   * Creates a proxy object for the given raw object, with the ability to intercept get and set operations.
   * If the raw object is not an object or already has a proxy, it is returned as is.
   *
   * @param {T} raw - The raw object to be proxied.
   * @param {Signal<any>} sig - The signal object that created the proxy.
   * @param {HookPath} path - The path of the property being accessed.
   * @return {T} The proxied object.
   */
  static toProxy<T>(raw: T, sig: Signal<any>, path: HookPath): T {
    if (!isObject(raw)) {
      return raw;
    }
    if (this.raw2proxy.has(raw)) {
      return this.raw2proxy.get(raw);
    }
    const proxy = new Proxy(raw, {
      get: (target, prop, receiver) => {
        const cur_path = [...path, prop];
        let ret = Reflect.get(target, prop, receiver);
        if (sig.options.deep && isObject(ret)) {
          ret = this.toProxy(ret, sig, cur_path);
        }
        sig.emit_get(cur_path);
        return ret;
      },
      set: (target, prop, value, receiver) => {
        if (sig.close) {
          throw new Error("Signal is closed");
        }
        const cur_path = [...path, prop];
        const ret = Reflect.set(target, prop, value, receiver);
        sig.emit_set(value, cur_path);
        return ret;
      },
    });
    this.proxy2raw.set(proxy, raw);
    this.raw2proxy.set(raw, proxy);
    return proxy;
  }

  // @ts-ignore
  private [VALUE]: T;

  private get_hooks = new Set<GetterHook>();
  private set_hooks = new Set<SetterHook>();

  private close = false;

  _id = Math.random().toString(36).slice(2);

  /**
   * Constructor for creating a new Signal instance.
   *
   * @param {T} initialValue - The initial value for the Signal instance.
   * @param {{ deep?: boolean; onGet?: GetterHook; onSet?: SetterHook; }} options - Optional configuration options.
   */
  constructor(
    initialValue: T,
    private options: SignalOptions = {
      deep: true,
    }
  ) {
    super();
    if (options.onGet) this.get_hooks.add(options.onGet);
    if (options.onSet) this.set_hooks.add(options.onSet);
    this[VALUE] = initialValue;

    Record.record(this);
    this.onDispose(this.cleanup.bind(this));

    Signal.signals.set(this._id, this);
    this.onDispose(() => Signal.signals.delete(this._id));
  }

  protected emit_get(path: HookPath) {
    this.get_hooks.forEach((hook) => hook(this[VALUE], path, this));
    Signal.get_hooks.forEach((hook) => hook(this[VALUE], path, this));
  }

  protected emit_set(setValue: any, path: HookPath) {
    this.set_hooks.forEach((hook) => hook(this[VALUE], setValue, path, this));
    Signal.set_hooks.forEach((hook) => hook(this[VALUE], setValue, path, this));
  }

  /**
   * Retrieves the current value of the signal and emits the get event.
   *
   * @return {T} The current value of the signal
   */
  get(): T {
    const path = ["value"];
    const value = this[VALUE];
    this.emit_get(path);
    return Signal.toProxy(value, this, path);
  }

  /**
   * Retrieves the current value of the signal and emits the get event.
   *
   * @return {T} The current value of the signal
   */
  get value(): T {
    return this.get();
  }

  /**
   * Sets a new value for the signal and emits the set event.
   *
   * @param {T} newValue - The new value to set for the signal.
   * @throws {Error} If the signal is closed.
   */
  set(newValue: T) {
    if (this.close) {
      throw new Error("Signal is closed");
    }
    if (Object.is(this[VALUE], newValue)) {
      return;
    }
    const path = ["value"];
    this[VALUE] = newValue;
    this.emit_set(newValue, path);
  }

  /**
   * Sets the new value for the signal and emits the set event.
   *
   * @param {T} newValue - The new value to set for the signal.
   */
  set value(newValue: T) {
    this.set(newValue);
  }

  trigger(path: HookPath = ["value"]) {
    this.emit_set(this[VALUE], path);
  }

  dependent(path: HookPath = ["value"]) {
    this.emit_get(path);
  }

  /**
   * Subscribes to changes in the signal by adding getter and setter hooks.
   *
   * @param {GetterHook} getter - Optional getter hook function.
   * @param {SetterHook} setter - Optional setter hook function.
   * @return {Function} Function to unsubscribe from the signal.
   */
  subscribe({
    getter,
    setter,
    once,
  }: {
    getter?: GetterHook;
    setter?: SetterHook;
    once?: boolean;
  }) {
    const unsubscribe = () => {
      if (getter) this.unsubscribe(getter);
      if (setter) this.unsubscribe(setter);
    };

    if (getter)
      this.get_hooks.add((...args) => {
        getter(...args);
        if (once) this.unsubscribe(getter);
      });
    if (setter)
      this.set_hooks.add((...args) => {
        setter(...args);
        if (once) this.unsubscribe(setter);
      });

    return unsubscribe;
  }

  /**
   * Unsubscribes from the signal by removing the provided getter or setter hook.
   *
   * @param {GetterHook | SetterHook} fn - The hook function to unsubscribe.
   */
  unsubscribe(fn: GetterHook | SetterHook) {
    this.get_hooks.delete(fn as any);
    this.set_hooks.delete(fn as any);
  }

  /**
   * Creates an asynchronous generator that yields the values of the signal.
   *
   * @param {Object} options - Optional configuration object.
   * @param {boolean} options.next_now - If true, the generator will yield the current value of the signal immediately.
   * @return {AsyncGenerator<T>} An asynchronous generator that yields the values of the signal.
   */
  iterator(options?: { next_now?: boolean }) {
    const that = this;
    return {
      [Symbol.asyncIterator]: async function* () {
        const queue = [] as any[];
        if (options?.next_now)
          queue.push(Signal.toProxy(that[Signal.VALUE], that, []));
        const unsubscribe = that.subscribe({
          setter: (value, path) => {
            queue.push(Signal.toProxy(value, that, path));
          },
        });
        while (that.close == false) {
          const next = queue.shift();
          if (next) {
            yield next;
            continue;
          }
          await new Promise((resolve) => {
            that.subscribe({ setter: () => resolve(null) });
          });
        }
        unsubscribe();
      },
    } as AsyncGenerator<T>;
  }

  /**
   * Clean up the get and set hooks by clearing them.
   *
   * @param {} -
   * @return {} -
   */
  cleanup() {
    this.get_hooks.clear();
    this.set_hooks.clear();
  }

  *[Symbol.iterator]() {
    yield () => this.get();
    yield (value) => this.set(value);
  }
}

export class ShallowSignal<T = any> extends Signal<T> {
  protected emit_set(setValue: any, path: HookPath): void {
    if (path.length !== 1 && path[0] !== "value") return;
    super.emit_set(setValue, path);
  }
}

export type HookSignalFn<T = any> = (
  track: () => void,
  trigger: () => void
) => {
  get: () => T;
  set: (value: T) => void;
};

export class HookSignal<T = any> extends Signal<T> {
  private hooks: {
    get: () => T;
    set: (value: T) => void;
  };

  constructor(
    fn: HookSignalFn<T>,
    options: SignalOptions = {
      deep: true,
    }
  ) {
    super(null as any, options);
    this.hooks = fn(
      () => this.dependent(),
      () => this.trigger()
    );
  }

  get(): T {
    this.emit_get(["value"]);
    return this.hooks.get();
  }

  set(newValue: T): void {
    this.emit_set(newValue, ["value"]);
    this.hooks.set(newValue);
  }
}

// const main = () => {
//   // Example usage:
//   const signal = new Signal<{ x: { y: number } }>(
//     { x: { y: 1 } },
//     {
//       deep: true,
//       onGet: (value, path, sig) => {
//         console.log("get", path, JSON.stringify(value));
//       },
//       onSet: (value, setValue, path, sig) => {
//         console.log("set", setValue, path, JSON.stringify(value));
//       },
//     }
//   );
//   signal.value.x.y = 2;
//   signal.value = { x: { y: 3 } };
//   signal.value.x.y = 4;
// };

// main();

// const eg_iter = () => {
//   const sig1 = new Signal(1);
//   (async () => {
//     for await (const value of sig1.iterator()) {
//       console.log(`iter: ${value}`);
//     }
//   })();

//   sig1.value = 2;
//   sig1.value = 3;
//   sig1.value = 4;
//   sig1.value = 5;
//   sig1.value += 1;
// };
// eg_iter();
