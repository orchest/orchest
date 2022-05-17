import React from "react";
import { useCancelablePromise } from "./useCancelablePromise";

export type STATUS = "IDLE" | "PENDING" | "RESOLVED" | "REJECTED";

export type Action<T, E> = {
  type: STATUS;
  data?: T;
  error?: E;
  caching?: boolean;
};

type State<T, E> = {
  status: STATUS;
  data: T | undefined;
  error: E | undefined;
};

const asyncReducer = <T, E>(
  state: State<T, E>,
  action: Action<T, E>
): State<T, E> => {
  switch (action.type) {
    case "PENDING": {
      const payload = action.caching ? state.data : undefined;
      return { status: "PENDING", data: payload, error: undefined };
    }
    case "RESOLVED": {
      return {
        status: "RESOLVED",
        data: action.data,
        error: undefined,
      };
    }
    case "REJECTED": {
      return { status: "REJECTED", data: undefined, error: action.error };
    }
    default: {
      throw new Error(`Unhandled action type: ${action.type}`);
    }
  }
};

type AsyncParams<T> = {
  initialState?: T;
  caching?: boolean; // if true, data will not be set to null when re-fetching data
};

const useAsync = <T, E = Error>(params?: AsyncParams<T> | undefined) => {
  const { initialState, caching = false } = params || {};
  const [state, dispatch] = React.useReducer<
    (state: State<T, E>, action: Action<T, E>) => State<T, E>
  >(asyncReducer, {
    status: "IDLE",
    data: undefined,
    error: undefined,
    ...initialState,
  });

  const { data, error, status } = state as State<T, E>;
  const { makeCancelable } = useCancelablePromise();

  const run = React.useCallback(
    (promise: Promise<T>): Promise<T> => {
      dispatch({ type: "PENDING", caching });
      return makeCancelable(promise).then(
        (data) => {
          dispatch({ type: "RESOLVED", data });
          return data;
        },
        (error) => {
          dispatch({ type: "REJECTED", error });
          return error;
        }
      );
    },
    [dispatch, caching, makeCancelable]
  );

  const setData = React.useCallback(
    (
      action: T | undefined | ((currentValue: T | undefined) => T | undefined)
    ) => {
      const newData = action instanceof Function ? action(data) : action;
      dispatch({ type: "RESOLVED", data: newData });
    },
    [dispatch, data]
  );
  const setError = React.useCallback(
    (error) => dispatch({ type: "REJECTED", error }),
    [dispatch]
  );

  return {
    setData,
    setError,
    error,
    status,
    data,
    run,
  };
};

export { useAsync };
