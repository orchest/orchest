import { fetcher } from "@orchest/lib-utils";
import React from "react";

type CancelablePromise<T> = {
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

export function useCancellablePromise() {
  const cancelablePromises = React.useRef<CancelablePromise<unknown>[]>([]);
  React.useEffect(() => {
    return () => {
      cancelablePromises.current.forEach((p) => p.cancel());
      cancelablePromises.current = [];
    };
  }, []);

  const makeCancelable = React.useCallback(function <T>(p: Promise<T>) {
    const cPromise = _makeCancelable(p);
    cancelablePromises.current.push(cPromise);
    return cPromise.promise;
  }, []);

  return { makeCancelable };
}

export function useCancellableFetch() {
  const { makeCancelable } = useCancellablePromise();
  const cancellableFetch = React.useCallback(
    function <T>(
      url: string,
      params?: RequestInit | undefined,
      cancelable = true
    ) {
      return cancelable
        ? makeCancelable(fetcher<T>(url, params))
        : fetcher<T>(url, params);
    },
    [makeCancelable]
  );

  return { fetcher: cancellableFetch };
}
