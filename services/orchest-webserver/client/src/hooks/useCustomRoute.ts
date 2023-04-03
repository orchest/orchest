import { RouteName, siteMap } from "@/routingConfig";
import { ScopeParameter, ScopeParameters } from "@/types";
import { openInNewTab } from "@/utils/openInNewTab";
import { equalsShallow, pick, prune } from "@/utils/record";
import { toQueryString } from "@/utils/routing";
import { ALL_SCOPE_PARAMETERS } from "@/utils/scope";
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

// see https://v5.reactrouter.com/web/example/query-parameters
// e.g. https://example.com/user?foo=123&bar=abc
// const [foo, bar] = useLocationQuery(['foo', 'bar']);
// console.log(foo); // '123'
// console.log(bar); // 'abc'
// NOTE: the returned value is ALWAYS a string
export const useLocationQuery = (
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

export const useHistoryListener = <T>({
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
  }, [backward, forward, history, onPush]);
};

export type NavigateParams = {
  query?: Record<string, string | number | boolean | undefined | null>;
  state?: Record<string, string | number | boolean | undefined | null>;
  replace?: boolean;
};

export const useCurrentQuery = () => {
  const valueArray = useLocationQuery([
    "job_uuid",
    "run_uuid",
    "snapshot_uuid",
    "project_uuid",
    "pipeline_uuid",
    "environment_uuid",
    "step_uuid",
    "file_path",
    "file_root",
    "tab",
  ]);

  const [
    jobUuid,
    runUuid,
    snapshotUuid,
    projectUuid,
    pipelineUuid,
    environmentUuid,
    stepUuid,
    filePath,
    fileRoot,
    tab,
  ] = valueArray.map((value) => {
    // if value is `null` or `undefined`, return `undefined`
    // stringify the value for all the other cases.
    return !hasValue(value) ? undefined : String(value);
  });

  return {
    projectUuid,
    pipelineUuid,
    environmentUuid,
    stepUuid,
    jobUuid,
    runUuid,
    snapshotUuid,
    filePath,
    fileRoot,
    tab,
  };
};

export type KnownQueryParameters = ReturnType<typeof useCurrentQuery>;

// these are common use cases that are all over the place
// if there are specific cases that you need to pass some query strings or states
// better make use of useLocationQuery and useLocationState
export const useCustomRoute = () => {
  const history = useHistory();
  const location = useLocation();
  const query = useCurrentQuery();

  const [isReadOnly, prevPathname] = useLocationState<
    [boolean, string, boolean]
  >(["isReadOnly", "prevPathname"]);

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
        openInNewTab(window.location.origin + pathname + queryString);
      } else {
        const mutateHistory = replace ? history.replace : history.push;
        mutateHistory({
          pathname,
          search: queryString,
          state: { ...state, prevPathname: history.location.pathname },
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
    location,
    prevPathname,
    ...query,
  };
};

export const useCreateRouteLink = () => {
  const currentRoute = useCustomRoute();

  return (name: RouteName, params: Partial<Record<ScopeParameter, string>>) => {
    const { path, scope = [] } = siteMap[name];

    return (
      path +
      toQueryString({ ...pick(currentRoute, ...scope), ...prune(params) })
    );
  };
};

export type NavigationOptions = {
  /** The new route to navigate to. If omitted, the current route is used. */
  route?: RouteName;
  /** The new scope parameters to use in the query. */
  query?: Partial<KnownQueryParameters>;
  /** If `sticky` is true: Clear the following query parameters. */
  clear?: ScopeParameter[];
  /**
   * Preserve all previous query parameters that are supported by the route.
   * Default: true.
   */
  sticky?: boolean;
  /**
   * Replace the state instead of pushing a new one.
   * Default: false
   */
  replace?: boolean;
};

export type NavigateOptions = NavigationOptions & {
  event?: React.MouseEvent;
};

const findCurrentRoute = (): RouteName | undefined => {
  const path = window.location.pathname;

  for (const [routeName, data] of Object.entries(siteMap)) {
    if (data.path === path) return routeName as RouteName;
  }

  return undefined;
};

/**
 * Returns a link to the specified route.
 * Note: Links are "sticky" by default,
 * meaning that the query parameters that are
 * supported by the provided route are preserved.
 */
export function useRouteLink(
  options: NavigateOptions & { route: string }
): string;
export function useRouteLink(options: NavigateOptions): string | undefined;
export function useRouteLink({
  route = findCurrentRoute(),
  sticky = true,
  query = {},
  clear = [],
}: NavigationOptions) {
  const currentQuery = useCurrentQuery();

  if (!route) return undefined;

  const { path, scope } = siteMap[route];

  const newQuery = prune(
    sticky ? stickyQuery(currentQuery, { query, scope }) : prune(query),
    ([name]) => !clear.includes(name as ScopeParameter)
  );

  return path + toQueryString(newQuery);
}

/**
 * Returns a function which is used to navigate between routes.
 * Navigation is "sticky" by default: supported query parameters from
 * the previous page are persisted when navigating between routes.
 */
export const useNavigate = () => {
  const { navigateTo } = useCustomRoute();
  const currentQuery = useCurrentQuery();

  return React.useCallback(
    ({
      route = findCurrentRoute(),
      query = {},
      clear = [],
      sticky = true,
      replace = false,
      event,
    }: NavigateOptions) => {
      if (!route) return;

      const { path, scope = [] } = siteMap[route];
      const isSamePath = path === window.location.pathname;
      const newQuery = prune(
        sticky ? stickyQuery(currentQuery, { query, scope }) : prune(query),
        ([name]) => !clear.includes(name as ScopeParameter)
      );

      const isSameUrl =
        isSamePath &&
        equalsShallow(newQuery, currentQuery, ALL_SCOPE_PARAMETERS);

      if (isSameUrl) return;

      navigateTo(path, { replace, query: newQuery }, event);
    },
    [currentQuery, navigateTo]
  );
};

type StickyQuery = {
  scope: ScopeParameter[];
  query: Partial<ScopeParameters>;
};

const stickyQuery = (
  currentQuery: Record<string, string | undefined>,
  { query, scope }: StickyQuery
) => ({
  ...prune(pick(currentQuery, ...scope)),
  ...prune(query),
});
