import { fetcher } from "@orchest/lib-utils";
import React from "react";

export type CancelablePromise<T> = {
  promise: Promise<T>;
  cancel: () => void;
};

// https://reactjs.org/blog/2015/12/16/ismounted-antipattern.html
function _makeCancelable<T>(promise: Promise<T>) {
  let isCanceled = false;
  const wrappedPromise = new Promise<T>((resolve, reject) => {
    promise
      .then((val) => (isCanceled ? reject({ isCanceled }) : resolve(val)))
      .catch((error) => (isCanceled ? reject({ isCanceled }) : reject(error)));
  });
  return {
    promise: wrappedPromise,
    cancel() {
      isCanceled = true;
    },
  };
}

export function useCancelablePromise() {
  const cancelablePromises = React.useRef<CancelablePromise<unknown>[]>([]);

  const makeCancelable = React.useCallback(function <T = void>(p: Promise<T>) {
    const cPromise = _makeCancelable(p);
    cancelablePromises.current.push(cPromise);
    return cPromise.promise;
  }, []);

  const cancelAll = React.useCallback(() => {
    () => {
      cancelablePromises.current.forEach((p) => p.cancel());
      cancelablePromises.current = [];
    };
  }, []);

  React.useEffect(() => {
    return () => cancelAll();
  }, [cancelAll]);

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
