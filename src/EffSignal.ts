import { Effect, EffectScope } from "./Effect";
import { Signal } from "./Signal";

export type MemoFn<T> = (
  next: (data: T) => void,
  context: Record<keyof any, any>
) => void;

export class EffectSignal<T> extends Signal<T> {
  private __eff: Effect;
  private _context: Record<keyof any, any> = {};

  constructor(readonly memoFn: MemoFn<T>) {
    super(null as T);
    this.__eff = new Effect(() => memoFn(this.set.bind(this), this._context));
    this.__eff.run();
  }

  cleanup(): void {
    this.__eff.cleanup();
    super.cleanup();
  }
}

// const main = () => {
//   const sig1 = new Signal(1);
//   const sig2 = new EffectSignal((next) => next(sig1.value * 2));

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
