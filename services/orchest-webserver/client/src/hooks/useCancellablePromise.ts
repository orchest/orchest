import { fetcher } from "@orchest/lib-utils";
import React from "react";

type CancelablePromise<T> = {
  promise: Promise<T>;
  cancel: () => void;
};

// https://reactjs.org/blog/2015/12/16/ismounted-antipattern.html
function makeCancelable<T>(promise: Promise<T>) {
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

  const makeCancellable = React.useCallback(function <T>(p: Promise<T>) {
    const cPromise = makeCancelable(p);
    cancelablePromises.current.push(cPromise);
    return cPromise.promise;
  }, []);

  return { makeCancellable };
}

export function useCancalableFetch() {
  const { makeCancellable } = useCancellablePromise();
  const cancellableFetch = React.useCallback(
    function <T>(url: string, params?: RequestInit | undefined) {
      return makeCancellable(fetcher<T>(url, params));
    },
    [makeCancellable]
  );

  return { fecther: cancellableFetch };
}
