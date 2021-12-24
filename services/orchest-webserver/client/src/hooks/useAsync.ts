import { useCallback, useLayoutEffect, useReducer, useRef } from "react";

export type STATUS = "IDLE" | "PENDING" | "RESOLVED" | "REJECTED";

export type Action<T> = {
  type: STATUS;
  data: T;
  error: Error;
};

type State<T> = {
  status: STATUS;
  data: T | null;
  error: Error | null;
};

const useSafeDispatch = <T>(dispatch: React.Dispatch<Action<T>>) => {
  const mounted = useRef(false);

  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  return useCallback(
    (action) => (mounted.current ? dispatch(action) : void 0),
    [dispatch]
  );
};

const asyncReducer = <T>(state: State<T>, action: Action<T>): State<T> => {
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

const useAsync = <T>(initialState?: T) => {
  const [state, unsafeDispatch] = useReducer<
    (state: State<T>, action: Action<T>) => State<T>
  >(asyncReducer, {
    status: "IDLE",
    data: null,
    error: null,
    ...initialState,
  });

  const dispatch = useSafeDispatch(unsafeDispatch);

  const { data, error, status } = state as State<T>;

  const run = useCallback(
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

  const setData = useCallback((data) => dispatch({ type: "RESOLVED", data }), [
    dispatch,
  ]);
  const setError = useCallback(
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
