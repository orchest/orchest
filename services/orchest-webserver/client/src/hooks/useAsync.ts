import React from "react";

export type STATUS = "IDLE" | "PENDING" | "RESOLVED" | "REJECTED";

export type Action<T, E> = {
  type: STATUS;
  data?: T;
  error?: E;
  caching?: boolean;
};

type State<T, E> = {
  status: STATUS;
  data: T | null;
  error: E | null;
};

const useSafeDispatch = <T, E>(dispatch: React.Dispatch<Action<T, E>>) => {
  const mounted = React.useRef(false);

  React.useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  return React.useCallback(
    (action: Action<T, E>) => (mounted.current ? dispatch(action) : void 0),
    [dispatch]
  );
};

const asyncReducer = <T, E>(
  state: State<T, E>,
  action: Action<T, E>
): State<T, E> => {
  switch (action.type) {
    case "PENDING": {
      const payload = action.caching ? state.data : null;
      return { status: "PENDING", data: payload, error: null };
    }
    case "RESOLVED": {
      return {
        status: "RESOLVED",
        data: action.data,
        error: null,
      };
    }
    case "REJECTED": {
      return { status: "REJECTED", data: null, error: action.error };
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
  const [state, unsafeDispatch] = React.useReducer<
    (state: State<T, E>, action: Action<T, E>) => State<T, E>
  >(asyncReducer, {
    status: "IDLE",
    data: null,
    error: null,
    ...initialState,
  });

  const dispatch = useSafeDispatch(unsafeDispatch);

  const { data, error, status } = state as State<T, E>;

  const run = React.useCallback(
    (promise: Promise<T>) => {
      dispatch({ type: "PENDING", caching });
      return promise.then(
        (data) => {
          dispatch({ type: "RESOLVED", data });
          return data;
        },
        (error) => {
          dispatch({ type: "REJECTED", error });
          return;
        }
      );
    },
    [dispatch, caching]
  );

  const setData = React.useCallback(
    (action: T | ((currentValue: T) => T)) => {
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
