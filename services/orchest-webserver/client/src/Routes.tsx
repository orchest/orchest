import React from "react";
import { Redirect, Route, Switch, useParams } from "react-router-dom";

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
        const { name, path, component } = route;
        const shouldBeExact = name !== "notFound"; // notFound uses * as a fallback
        return (
          <Route
            exact={shouldBeExact}
            key={name}
            path={path}
            component={component}
          />
        );
      })}
    </Switch>
  );
};

export { siteMap, Routes, generatePathFromRoute, toQueryString };
