import { toQueryString } from "@/routingConfig";
import React from "react";
import { useHistory, useLocation } from "react-router-dom";

// NOTE: if the parameter is safe to expose to user (i.e. component can read it from the URL), use useLocationQuery
// For the data that we want to persist and we don't want to expose, use useLocationState

// const [email, mobile, isReadOnly] = useLocationState<[string, number, boolean]>(['email', 'mobile', 'isActive'])
// console.log(email); // 'john@email.com'
// console.log(mobile); // 0612345678
// console.log(isReadOnly); // true
const useLocationState = <T>(stateNames: string[]) => {
  const location = useLocation();
  return (stateNames.map((stateName) =>
    location.state ? location.state[stateName] : null
  ) as unknown) as T;
};

// see https://reactrouter.com/web/example/query-parameters
// e.g. https://example.com/user?foo=123&bar=abc
// const [foo, bar] = useLocationQuery(['foo', 'bar']);
// console.log(foo); // '123'
// console.log(bar); // 'abc'
// NOTE: the returned value is ALWAYS a string
const useLocationQuery = (
  queryStrings: string[]
): (string | boolean | null | undefined)[] => {
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  return queryStrings.map((str) => {
    const value = query.get(str);
    if (value === "undefined") return undefined;
    if (value === "null") return null;
    if (value === "true") return true;
    if (value === "false") return false;
    // NOTE: we don't handle numbers!
    return value;
  });
};

const useHistoryListener = <T>({
  forward,
  backward,
  onPush,
}: {
  forward?: (history) => void;
  backward?: (history) => void;
  onPush?: (history) => void;
}) => {
  const history = useHistory<T>();
  const locationKeysRef = React.useRef([]);
  React.useEffect(() => {
    const removeListener = history.listen((location) => {
      if (history.action === "PUSH") {
        locationKeysRef.current = [location.key];
        onPush && onPush(history);
      }
      if (history.action === "POP") {
        const isForward = locationKeysRef.current[1] === location.key;
        if (isForward) {
          forward && forward(history);
        } else {
          backward && backward(history);
        }

        // update location keys
        locationKeysRef.current =
          locationKeysRef.current[1] === location.key
            ? locationKeysRef.current.slice(1)
            : [location.key, ...locationKeysRef.current];
      }
    });
    return removeListener;
  }, []);
};

// these are common use cases that are all over the place
// if there are specific cases that you need to pass some querystrings or states
// better make use of useLocationQuery and useLocationState
const useCustomRoute = () => {
  const history = useHistory();

  const [isReadOnly] = useLocationState<[boolean]>(["isReadOnly"]);
  const valueArray = useLocationQuery([
    "job_uuid",
    "run_uuid",
    "initial_tab",
    "project_uuid",
    "pipeline_uuid",
    "environment_uuid",
    "step_uuid",
  ]);

  const [
    jobUuid,
    runUuid,
    initialTab,
    projectUuid,
    pipelineUuid,
    environmentUuid,
    stepUuid,
  ] = valueArray as (string | undefined | null)[]; // asserting all values are string

  type NavigateParams = {
    query?: Record<string, string | number | boolean>;
    state?: Record<string, string | number | boolean | undefined | null>;
  };

  const navigateTo = (path: string, params?: NavigateParams) => {
    const { query = null, state = {} } = params || {};
    history.push({
      pathname: path,
      search: toQueryString(query),
      state,
    });
  };

  return {
    navigateTo,
    isReadOnly,
    projectUuid,
    pipelineUuid,
    environmentUuid,
    stepUuid,
    jobUuid,
    runUuid,
    initialTab,
  };
};

export {
  useLocationState,
  useLocationQuery,
  useHistoryListener,
  useCustomRoute,
};
