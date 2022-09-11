// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AsyncFunction<T> = (...args: any[]) => Promise<T>;

/**
 * Limits creation of new promises from an asynchronous function.
 * While the the promise from the first call is pending,
 * consecutive calls with equal arguments returns
 * the promise from the first call instead of creating a new one.
 *
 * This is useful in (for example) fetcher functions when multiple components
 * can request the same data within short succession.
 *
 * Arguments are compared by value using `JSON.stringify`.
 * @param fn The function to choke.
 * @returns
 *  A proxy function that either calls `fn` or
 *  returns a pending promise created with equal arguments.
 */
export const choke = <T, F extends AsyncFunction<T>>(fn: F): F => {
  const pending: Record<string, Promise<T>> = Object.create(null);

  return ((...args: Parameters<F>) => {
    const key = args
      .map((arg) =>
        typeof arg === "bigint" ? arg.toString() : JSON.stringify(arg)
      )
      .join(", ");

    return (pending[key] ??= fn(...args).finally(() => delete pending[key]));
  }) as F;
};

export type CancelablePromise<T = unknown> = Promise<T> & {
  isCanceled: () => boolean;
  cancel: () => void;
};

export class PromiseCanceledError extends Error {
  isCanceled = true;

  constructor(message = "The promise was canceled.") {
    super(message);
  }
}

/**
 * Wraps a promise in a new one that can be canceled.
 * If the `cancel` function is called, the promise always reject with a `PromiseCanceledError`.
 */
export function toCancelablePromise<T>(
  promise: Promise<T>,
  onCanceled?: () => void
): CancelablePromise<T> {
  let isCanceled = false;

  const wrappedPromise = new Promise<T>((resolve, reject) => {
    promise
      .then((result) => {
        isCanceled ? reject(new PromiseCanceledError()) : resolve(result);
      })
      .catch((error) =>
        isCanceled ? reject(new PromiseCanceledError()) : reject(error)
      )
      .finally(onCanceled);
  });

  return Object.assign(wrappedPromise, {
    isCanceled: () => isCanceled,
    cancel: () => {
      isCanceled = true;
      onCanceled?.();
    },
  });
}
