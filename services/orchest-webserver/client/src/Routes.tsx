import React from "react";
import { Redirect, Route, Switch } from "react-router-dom";

import {
  siteMap,
  orderedRoutes,
  generatePathFromRoute,
  toQueryString,
} from "./routingConfig";
import { TViewProps } from "./types";

const Routes = () => {
  return (
    <Switch>
      <Route exact path="/">
        <Redirect to={siteMap.projects.path} />
      </Route>
      {orderedRoutes.map((route) => {
        const { name, path, component, title } = route;
        const Component: React.FC<TViewProps> = component;
        const shouldBeExact = name !== "notFound"; // notFound uses * as a fallback, it cannot be exact
        return (
          <Route
            exact={shouldBeExact}
            key={name}
            path={path}
            render={(props) => <Component {...props} title={title} />}
          />
        );
      })}
      <Route path="*">
        <Redirect to={siteMap.projects.path} />
      </Route>
    </Switch>
  );
};

export { siteMap, Routes, generatePathFromRoute, toQueryString };
