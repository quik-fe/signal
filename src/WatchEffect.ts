import { Effect, EffectOptions } from "./Effect";

export class WatchEffect<T> extends Effect<T> {
  oldValue: T;
  value: T;

  constructor(
    watch: () => T,
    fn: (value: T, oldValue: T | undefined) => void,
    options?: EffectOptions
  ) {
    super(() => {
      this.oldValue = this.value;
      this.value = watch();

      // stop tracking in this effect
      Effect.active = undefined;
      try {
        fn(this.value, this.oldValue);
      } catch (error) {
        console.error(error);
      } finally {
        Effect.active = this;
      }
      return this.value;
    }, options);
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
