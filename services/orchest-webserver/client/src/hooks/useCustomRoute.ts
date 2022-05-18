import { openInNewTab } from "@/utils/openInNewTab";
import { toQueryString } from "@/utils/routing";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useHistory, useLocation } from "react-router-dom";

// NOTE: if the parameter is safe to expose to user (i.e. component can read it from the URL), use useLocationQuery
// For the data that we want to persist and we don't want to expose, use useLocationState

// const [email, mobile, isReadOnly] = useLocationState<[string, number, boolean]>(['email', 'mobile', 'isActive'])
// console.log(email); // 'john@email.com'
// console.log(mobile); // 0612345678
// console.log(isReadOnly); // true
const useLocationState = <T>(stateNames: string[]) => {
  const location = useLocation<{ state: Record<string, T> }>();
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
  forward?: (history: unknown) => void;
  backward?: (history: unknown) => void;
  onPush?: (history: unknown) => void;
}) => {
  const history = useHistory<T>();
  const locationKeysRef = React.useRef<string[]>([]);
  React.useEffect(() => {
    const removeListener = history.listen((location) => {
      const locationKey = location.key || "";
      if (history.action === "PUSH") {
        locationKeysRef.current = [locationKey];
        onPush && onPush(history);
      }
      if (history.action === "POP") {
        const isForward = locationKeysRef.current[1] === locationKey;
        if (isForward) {
          forward && forward(history);
        } else {
          backward && backward(history);
        }

        // update location keys
        locationKeysRef.current =
          locationKeysRef.current[1] === locationKey
            ? locationKeysRef.current.slice(1)
            : [locationKey, ...locationKeysRef.current];
      }
    });
    return removeListener;
  }, []);
};

export type NavigateParams = {
  query?: Record<string, string | number | boolean | undefined | null>;
  state?: Record<string, string | number | boolean | undefined | null>;
  replace?: boolean;
};

// these are common use cases that are all over the place
// if there are specific cases that you need to pass some querystrings or states
// better make use of useLocationQuery and useLocationState
const useCustomRoute = () => {
  const history = useHistory();

  const [isReadOnly, prevPathname] = useLocationState<
    [boolean, string, boolean]
  >(["isReadOnly", "prevPathname"]);
  const valueArray = useLocationQuery([
    "job_uuid",
    "run_uuid",
    "initial_tab",
    "project_uuid",
    "pipeline_uuid",
    "environment_uuid",
    "step_uuid",
    "file_path",
  ]);

  const [
    jobUuid,
    runUuid,
    initialTab,
    projectUuid,
    pipelineUuid,
    environmentUuid,
    stepUuid,
    filePath,
  ] = valueArray.map((value) => {
    // if value is `null` or `undefined`, return `undefined`
    // stringify the value for all the other cases.
    return !hasValue(value) ? undefined : String(value);
  });

  const navigateTo = React.useCallback(
    (
      path: string,
      params?: NavigateParams | undefined,
      e?: React.MouseEvent
    ) => {
      const [pathname, existingQueryString] = path.split("?");
      const { query = {}, state = {}, replace = false } = params || {};

      const isMouseMiddleClick = e?.nativeEvent && e.nativeEvent.button === 1;
      const shouldOpenNewTab = e?.ctrlKey || e?.metaKey || isMouseMiddleClick;

      const queryString = existingQueryString
        ? `${existingQueryString}&${toQueryString(query)}`
        : toQueryString(query);

      if (shouldOpenNewTab) {
        openInNewTab(`${window.location.origin}${pathname}${queryString}`);
      } else {
        const mutateHistory = replace ? history.replace : history.push;
        mutateHistory({
          pathname,
          search: queryString,
          state: { ...state, prevPathname: pathname },
        });
      }
    },
    [history]
  );

  /*
    queryArguments (from useLocationQuery) returned below are assumed
    to be static across the lifetime of mounted components.

    Therefore in Routes.tsx we enforce a component remount
    when the query string changes.

    For now we want to limit this assumption to just View components.
  */

  return {
    navigateTo,
    isReadOnly,
    projectUuid,
    pipelineUuid,
    environmentUuid,
    stepUuid,
    jobUuid,
    runUuid,
    filePath,
    initialTab,
    prevPathname,
  };
};

export {
  useLocationState,
  useLocationQuery,
  useHistoryListener,
  useCustomRoute,
};
