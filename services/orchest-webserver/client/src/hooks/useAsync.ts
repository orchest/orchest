import { ReducerActionWithCallback } from "@/types";
import React from "react";
import { useCancelablePromise } from "./useCancelablePromise";

export type STATUS = "IDLE" | "PENDING" | "RESOLVED" | "REJECTED";

export type Action<T, E = Error> = {
  type: STATUS;
  data?: T;
  error?: E;
  disableCaching?: boolean;
};

export type SetStateAction<T> =
  | T
  | undefined
  | ((currentValue: T | undefined) => T | undefined);

export type StateDispatcher<T> = (setStateAction: SetStateAction<T>) => void;

type State<T, E> = {
  status: STATUS;
  data: T | undefined;
  error: E | undefined;
};

type AsyncReducerAction<T, E> = ReducerActionWithCallback<
  State<T, E>,
  Action<T, E>
>;

const asyncReducer = <T, E>(
  state: State<T, E>,
  _action: AsyncReducerAction<T, E>
): State<T, E> => {
  const action = _action instanceof Function ? _action(state) : _action;
  switch (action.type) {
    case "PENDING": {
      const payload = action.disableCaching ? undefined : state.data;
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
  disableCaching?: boolean; // if true, data will be set to undefined when re-fetching data
};

const useAsync = <T, E = Error>(params?: AsyncParams<T> | undefined) => {
  const { initialState, disableCaching = false } = params || {};
  const [state, dispatch] = React.useReducer<
    (state: State<T, E>, action: AsyncReducerAction<T, E>) => State<T, E>
  >(asyncReducer, {
    status: "IDLE",
    data: undefined,
    error: undefined,
    ...initialState,
  });

  const { data, error, status } = state as State<T, E>;
  const { makeCancelable } = useCancelablePromise();

  const run = React.useCallback(
    async (promise: Promise<T>): Promise<T | void> => {
      dispatch({ type: "PENDING", disableCaching });
      try {
        const data = await makeCancelable(promise);
        dispatch({ type: "RESOLVED", data });
        return data;
      } catch (error) {
        if (error.isCanceled) return;
        dispatch({ type: "REJECTED", error });
        return Promise.reject(error);
      }
    },
    [dispatch, disableCaching, makeCancelable]
  );

  const setData: StateDispatcher<T> = React.useCallback(
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
    setData,
    setError,
    error,
    status,
    data,
    run,
  };
};

export { useAsync };
