import React from "react";
import { Redirect, Route, Switch } from "react-router-dom";

import {
  siteMap,
  orderedRoutes,
  generatePathFromRoute,
  toQueryString,
} from "./routingConfig";

const Routes = () => {
  return (
    <Switch>
      <Route exact path="/">
        <Redirect to={siteMap.projects.path} />
      </Route>
      {orderedRoutes.map((route) => {
        const { name, path, component, render } = route;
        const shouldBeExact = name !== "notFound"; // notFound uses * as a fallback
        return component ? (
          <Route
            exact={shouldBeExact}
            key={name}
            path={path}
            component={component}
          />
        ) : (
          <Route exact={shouldBeExact} key={name} path={path} render={render} />
        );
      })}
    </Switch>
  );
};

export { siteMap, Routes, generatePathFromRoute, toQueryString };
