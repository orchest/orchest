import { RouteData } from "@/routingConfig";
import React from "react";
import { matchPath } from "react-router-dom";
import { useHistoryListener } from "./useCustomRoute";

export const findRouteMatch = (routes: Pick<RouteData, "path" | "root">[]) => {
  for (const route of routes) {
    const match = matchPath(window.location.pathname, {
      path: route.path,
      exact: true,
    });
    if (match) return route;
  }
  return null;
};

const useMatchRoutePaths = (routes: Pick<RouteData, "path" | "root">[]) => {
  const routesRef = React.useRef(routes);
  const [match, setMatch] = React.useState(findRouteMatch(routesRef.current));
  const findRootMatch = React.useCallback(() => {
    const found = findRouteMatch(routesRef.current);
    setMatch(found);
  }, [routesRef]);
  useHistoryListener({
    forward: findRootMatch,
    backward: findRootMatch,
    onPush: findRootMatch,
  });
  return match;
};

export { useMatchRoutePaths };
