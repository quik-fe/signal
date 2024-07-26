import { Effect, EffectOptions } from "./Effect";
import { Signal } from "./Signal";
import { Tracker } from "./Tracker";

export class WatchEffect<T> extends Effect<T> {
  oldValue: T;
  value: T;

  constructor(
    watch: () => T,
    fn: (value: T, oldValue: T | undefined) => void,
    options?: EffectOptions
  ) {
    super(
      () => {
        this.oldValue = this.value;
        this.value = watch();
        return this.value;
      },
      {
        onTrigger: (sig) => {
          Tracker.pause();
          try {
            fn(this.value, this.oldValue);
            options?.onTrigger?.(sig);
          } finally {
            Tracker.resume();
          }
        },
      }
    );
  }
}

// const main = () => {
//   const sig1 = new Signal(1);
//   const sig2 = new Signal(2);

//   const eff = new WatchEffect(
//     () => sig1.value,
//     (value, oldValue) => {
//       console.log(value, oldValue);
//       console.log(sig2.value);
//     }
//   );
//   eff.run();

//   sig1.value = 2;
//   sig1.value = 3;
// };

// main();
