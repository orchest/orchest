import { AnyAsyncFunction, ResolutionOf } from "@/types";

export type CancelablePromise<T = unknown> = Promise<T> & {
  readonly isCanceled: () => boolean;
  readonly cancel: (message?: string) => void;
};

export class PromiseCanceledError extends Error {
  readonly name = "PromiseCanceledError";
  readonly isCanceled = true;

  constructor(message = "The promise was canceled.") {
    super(message);
  }
}

/**
 * Wraps a promise in a new one that can be canceled.
 * If the `cancel` function is called, the promise always rejects with a `PromiseCanceledError`,
 * regardless of whether it resolved or rejected.
 * @param original The original promise to make cancelable.
 * @param onEnd Called immediately when the promise is resolved, rejected, or canceled.
 */
export function makeCancelable<T>(
  original: Promise<T>,
  onEnd?: () => void
): CancelablePromise<T> {
  let cancelError: PromiseCanceledError | undefined = undefined;

  const promise = new Promise<T>((resolve, reject) => {
    original
      .then((result) => (cancelError ? reject(cancelError) : resolve(result)))
      .catch((error) => (cancelError ? reject(cancelError) : reject(error)))
      .finally(() => onEnd?.());
  });

  return Object.assign(promise, {
    isCanceled: () => Boolean(cancelError),
    cancel: (message?: string) => {
      cancelError = new PromiseCanceledError(message);
      onEnd?.();
    },
  });
}

export const isCancelable = <T>(
  promise: Promise<T>
): promise is CancelablePromise<T> =>
  typeof (promise as CancelablePromise).cancel === "function" &&
  typeof (promise as CancelablePromise).isCanceled === "function";

/** Represents a promise that may be memoized and canceled. */
export type MemoizedPromise<T = unknown> = CancelablePromise<T> & {
  /** Returns true if this promise is (still) memoized. */
  readonly isMemoized: () => boolean;
  /** Removes this promise from memory. */
  readonly forget: () => void;
};

/**
 * An asynchronous function which memoizes pending promises.
 * Memoization can be bypassed by calling `.bypass` instead of calling the function directly.
 */
export type MemoizePending<F extends AnyAsyncFunction, T = ResolutionOf<F>> = ((
  ...args: Parameters<F>
) => MemoizedPromise<T>) & {
  /** Bypasses pending promise memoization entirely. */
  bypass: (...args: Parameters<F>) => CancelablePromise<T>;
};

const DEFAULT_PROMISE_MEMO_TIMEOUT = 500;

export type MemoizeOptions = {
  /**
   * How long a promise will be memoized for, in milliseconds.
   * Defaults to `DEFAULT_PROMISE_MEMO_TIMEOUT` (500ms).
   *
   * After this duration has elapsed, calls to the function creates a new promise.
   */
  timeout?: number;
  /**
   * If true: promises that have been pending for longer than the configured `duration`
   * will be canceled and rejected with a `PromiseCanceledError` regardless of their result.
   * Defaults to `false`.
   */
  cancelExpired?: boolean;
};

/**
 * Memoizes the promises created by the provided async function.
 * This prevents the creation of new promises from the function
 * while one with identical parameters are still pending.
 *
 * This is useful in (for example) fetcher functions when multiple components
 * may request the same data within short succession, and you want to prevent
 * duplicate requests which are going to return the same response.
 *
 * Note: Parameters are compared by value using `JSON.stringify`.
 * @param fn A function which returns a promise to memoize by arguments.
 * @param options Optional memoization options.
 * @returns
 *  A proxy function that either calls `fn` and creates a new memoized promise,
 *  or returns a pending memoized promise created with identical arguments.
 */
export const memoized = <F extends AnyAsyncFunction, T = ResolutionOf<F>>(
  fn: F,
  {
    timeout: duration = DEFAULT_PROMISE_MEMO_TIMEOUT,
    cancelExpired = false,
  }: MemoizeOptions = {}
): MemoizePending<F, T> => {
  const pending: Record<string, MemoizedPromise<T>> = Object.create(null);

  const forget = (key: string, promise: MemoizedPromise<T>) => {
    if (pending[key] === promise) {
      delete pending[key];
    }
  };

  const makeMemoized = (
    key: string,
    promise: Promise<T>
  ): MemoizedPromise<T> => {
    const memoized: MemoizedPromise<T> = Object.assign(
      makeCancelable(promise),
      {
        isMemoized: () => pending[key] === memoized,
        forget: () => forget(key, memoized),
      }
    );

    memoized.finally(() => forget(key, memoized));

    if (duration !== Infinity) {
      window.setTimeout(() => {
        forget(key, memoized);

        if (cancelExpired) {
          memoized.cancel(`The promise expired after ${duration}ms.`);
        }
      }, duration);
    }

    pending[key] = memoized;

    return memoized;
  };

  const createKey = (args: Parameters<F>) =>
    args
      .map((arg) =>
        typeof arg === "bigint" ? arg.toString() : JSON.stringify(arg)
      )
      .join(", ");

  const proxy = (...args: Parameters<F>) => {
    const key = createKey(args);

    if (key in pending) {
      return pending[key];
    } else {
      return makeMemoized(key, fn(...args));
    }
  };

  return Object.assign(proxy, {
    bypass: (...args: Parameters<F>) => makeCancelable(fn(...args)),
  });
};
