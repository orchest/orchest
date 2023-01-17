import { ReducerActionWithCallback } from "@/types";
import { PromiseCanceledError } from "@/utils/promise";
import React from "react";
import { useCancelablePromise } from "./useCancelablePromise";

export type AsyncStatus = "IDLE" | "PENDING" | "RESOLVED" | "REJECTED";

export type Action<T, E = Error> = {
  type: AsyncStatus;
  data?: T;
  error?: E;
  disableCaching?: boolean;
};

export type SetStateAction<T> =
  | T
  | undefined
  | ((currentValue: T | undefined) => T | undefined);

export type StateDispatcher<T> = (setStateAction: SetStateAction<T>) => void;

type AsyncState<T, E> = {
  status: AsyncStatus;
  data: T | undefined;
  error: E | undefined;
};

type AsyncReducerAction<T, E> = ReducerActionWithCallback<
  AsyncState<T, E>,
  Action<T, E>
>;

type AsyncReducer<T, E> = (
  state: AsyncState<T, E>,
  action: AsyncReducerAction<T, E>
) => AsyncState<T, E>;

const asyncReducer = <T, E>(
  state: AsyncState<T, E>,
  _action: AsyncReducerAction<T, E>
): AsyncState<T, E> => {
  const action = _action instanceof Function ? _action(state) : _action;

  switch (action.type) {
    case "PENDING":
      return {
        status: "PENDING",
        data: action.disableCaching ? undefined : state.data,
        error: undefined,
      };
    case "RESOLVED":
      return { status: "RESOLVED", data: action.data, error: undefined };
    case "REJECTED":
      return { status: "REJECTED", data: undefined, error: action.error };
    default: {
      throw new Error(`Unhandled action type: ${action.type}`);
    }
  }
};

export type AsyncParams<T> = {
  initialState?: T;
  disableCaching?: boolean; // if true, data will be set to undefined when re-fetching data
};

/**
 * Allows for promise state tracking and
 * prevents promises from resolving when components are unmounted
 */
export const useAsync = <T, E = Error>({
  initialState,
  disableCaching,
}: AsyncParams<T> = {}) => {
  const { makeCancelable, cancelAll } = useCancelablePromise();
  const [{ data, error, status }, dispatch] = React.useReducer<
    AsyncReducer<T, E>
  >(asyncReducer, {
    status: "IDLE",
    data: undefined,
    error: undefined,
    ...initialState,
  });
  const isPending = React.useRef(false);

  const run = React.useCallback(
    async (promise: Promise<T>, force?: boolean): Promise<T | undefined> => {
      if (!force && isPending.current) return;
      if (force && isPending.current) cancelAll();

      isPending.current = true;
      dispatch({ type: "PENDING", disableCaching });

      try {
        const data = await makeCancelable(promise);
        dispatch({ type: "RESOLVED", data });
        isPending.current = false;
        return data;
      } catch (error) {
        isPending.current = false;
        if (error instanceof PromiseCanceledError) {
          return undefined;
        }
        dispatch({ type: "REJECTED", error });
        return Promise.reject(error);
      }
    },
    [dispatch, disableCaching, makeCancelable, cancelAll]
  );

  const setData = React.useCallback(
    (setStateAction: SetStateAction<T>) => {
      dispatch((prevState) => {
        const newData =
          setStateAction instanceof Function
            ? setStateAction(prevState.data)
            : setStateAction;

        return { type: "RESOLVED", data: newData };
      });
    },
    [dispatch]
  );

  const setError = React.useCallback(
    (error) => dispatch({ type: "REJECTED", error }),
    [dispatch]
  );

  return {
    /**
     * Starts tracking the promise.
     * If the component is unmounted while the promise is pending,
     * `undefined` is returned instead of the promise result.
     */
    run,
    /** Where the promise is in its lifecycle. */
    status,
    /** The error reason for the promise (when rejected). */
    error,
    /** The result of the promise (when resolved). */
    data,
    /** Sets the data which is normally captured when the promise is resolved. */
    setData,
    /** Sets the error which is normally set when the promise is rejected. */
    setError,
  };
};
