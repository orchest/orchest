import { CancelablePromise, toCancelablePromise } from "@/utils/promise";
import { fetcher } from "@orchest/lib-utils";
import React from "react";

const cancelAllPromises = (cancelablePromises: PromiseRecord) =>
  Object.values(cancelablePromises).forEach((p) => p.cancel());

type PromiseRecord = Record<number, CancelablePromise>;

// https://reactjs.org/blog/2015/12/16/ismounted-antipattern.html
export function useCancelablePromise() {
  const promisesById = React.useRef<PromiseRecord>({});

  const makeCancelable = React.useCallback(<T = void>(promise: Promise<T>) => {
    const promiseId = nextPromiseId();
    const cancelable = toCancelablePromise(promise, () => {
      // Delete the promise once it's canceled:
      delete promisesById.current[promiseId];
    });

    return (promisesById.current[promiseId] = cancelable);
  }, []);

  const cancelAll = React.useCallback(() => {
    () => cancelAllPromises(promisesById.current);
  }, []);

  React.useEffect(() => {
    const currentCancelablePromises = promisesById.current;
    return () => cancelAllPromises(currentCancelablePromises);
  }, []);

  return { makeCancelable, cancelAll };
}

export type CancelableFetch<T> = (
  url: string,
  params?: RequestInit | undefined
) => Promise<T>;

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

let lastPromiseId = 0;

const nextPromiseId = () => ++lastPromiseId;
