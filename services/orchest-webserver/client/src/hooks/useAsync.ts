import React from "react";

export type STATUS = "IDLE" | "PENDING" | "RESOLVED" | "REJECTED";

export type Action<T, E> = {
  type: STATUS;
  data: T;
  error: E;
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
    (action) => (mounted.current ? dispatch(action) : void 0),
    [dispatch]
  );
};

const asyncReducer = <T, E>(
  state: State<T, E>,
  action: Action<T, E>
): State<T, E> => {
  switch (action.type) {
    case "PENDING": {
      return { status: "PENDING", data: null, error: null };
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

const useAsync = <T, E = Error>(initialState?: T) => {
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
      dispatch({ type: "PENDING" });
      return promise.then(
        (data) => {
          dispatch({ type: "RESOLVED", data });
        },
        (error) => {
          dispatch({ type: "REJECTED", error });
        }
      );
    },
    [dispatch]
  );

  const setData = React.useCallback(
    (data) => dispatch({ type: "RESOLVED", data }),
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
