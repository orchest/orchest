import React from "react";
import { matchPath } from "react-router-dom";

import { siteMap } from "@/routingConfig";
import { useHistoryListener } from "./useCustomRoute";

const projectRootPaths = [
  siteMap.jobs.path,
  siteMap.environments.path,
  siteMap.pipelines.path,
];

const findRouteMatch = (paths: string[]) => {
  for (const path of paths) {
    const match = matchPath(window.location.pathname, {
      path,
      exact: true,
    });
    if (match) return match;
  }
  return null;
};

const useMatchProjectRoot = () => {
  const [match, setMatch] = React.useState(null);
  const findRootMatch = () => {
    const found = findRouteMatch(projectRootPaths);
    setMatch(found);
  };
  useHistoryListener({
    forward: findRootMatch,
    backward: findRootMatch,
    onPush: findRootMatch,
  });
  return match;
};

export { useMatchProjectRoot, projectRootPaths, findRouteMatch };
