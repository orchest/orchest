import { fetcher, uuidv4 } from "@orchest/lib-utils";
import React from "react";

export type CancelablePromise<T> = {
  promise: Promise<T>;
  cancel: () => void;
};

// https://reactjs.org/blog/2015/12/16/ismounted-antipattern.html
function _makeCancelable<T>(promise: Promise<T>, callback?: () => void) {
  let isCanceled = false;
  const wrappedPromise = new Promise<T>((resolve, reject) => {
    promise
      .then((val) => (isCanceled ? reject({ isCanceled }) : resolve(val)))
      .catch((error) => (isCanceled ? reject({ isCanceled }) : reject(error)))
      .finally(() => callback?.());
  });
  return {
    promise: wrappedPromise,
    cancel() {
      isCanceled = true;
      callback?.();
    },
  };
}

function cancelAllPromises<T>(
  cancelablePromises: Record<string, CancelablePromise<T>>
) {
  Object.values(cancelablePromises).forEach((p) => p.cancel());
  cancelablePromises = {};
}

export function useCancelablePromise() {
  const cancelablePromises = React.useRef<
    Record<string, CancelablePromise<unknown>>
  >({});

  const makeCancelable = React.useCallback(function <T = void>(p: Promise<T>) {
    const uuid = uuidv4();
    const cPromise = _makeCancelable(p, () => {
      delete cancelablePromises.current[uuid]; // Use the callback to clean up the promise.
    });
    cancelablePromises.current[uuid] = cPromise;
    return cPromise.promise;
  }, []);

  const cancelAll = React.useCallback(() => {
    () => cancelAllPromises(cancelablePromises.current);
  }, []);

  React.useEffect(() => {
    const currentCancelablePromises = cancelablePromises.current;
    return () => cancelAllPromises(currentCancelablePromises);
  }, []);

  return { makeCancelable, cancelAll };
}

export function useCancelableFetch() {
  const { makeCancelable, cancelAll } = useCancelablePromise();
  const cancelableFetch = React.useCallback(
    function <T>(url: string, params?: RequestInit | undefined) {
      return makeCancelable(fetcher<T>(url, params));
    },
    [makeCancelable]
  );

  return { cancelableFetch, cancelAll };
}
