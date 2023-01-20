import {
  CancelablePromise,
  makeCancelable as asCancelable,
} from "@/utils/promise";
import { fetcher } from "@orchest/lib-utils";
import React from "react";

const cancelAllPromises = (promises: PromiseRecord, message?: string) =>
  Object.values(promises).forEach((promise) => promise.cancel(message));

type PromiseRecord = Record<number, CancelablePromise>;

// https://reactjs.org/blog/2015/12/16/ismounted-antipattern.html
export function useCancelablePromise() {
  const promisesById = React.useRef<PromiseRecord>({});

  const makeCancelable = React.useCallback(<T = void>(promise: Promise<T>) => {
    const promiseId = nextPromiseId();
    const cancelable = asCancelable(promise, () => {
      // Delete the promise once it has been resolved, rejected or canceled.
      delete promisesById.current[promiseId];
    });

    promisesById.current[promiseId] = cancelable;

    return cancelable;
  }, []);

  const cancelAll = React.useCallback(
    () => cancelAllPromises(promisesById.current),
    []
  );

  React.useEffect(() => {
    const { current } = promisesById;

    return () =>
      cancelAllPromises(
        current,
        "A component was unmounted during a pending promise."
      );
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
