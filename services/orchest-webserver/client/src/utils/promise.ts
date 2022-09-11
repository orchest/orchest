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
