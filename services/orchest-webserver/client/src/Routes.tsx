import React from "react";
import { Redirect, Route, Switch } from "react-router-dom";

import { siteMap, orderedRoutes, toQueryString } from "./routingConfig";

const Routes = () => {
  return (
    <Switch>
      <Route exact path="/">
        <Redirect to={siteMap.projects.path} />
      </Route>
      {orderedRoutes.map((route) => {
        const { name, path, component, title } = route;
        const shouldBeExact = name !== "notFound"; // notFound uses * as a fallback, it cannot be exact
        return (
          <Route
            exact={shouldBeExact}
            key={name}
            path={path}
            render={() => {
              window.document.title = title;
              const Component = component;
              return <Component />;
            }}
          />
        );
      })}
      <Route path="*">
        <Redirect to={siteMap.projects.path} />
      </Route>
    </Switch>
  );
};

export { siteMap, Routes, toQueryString };
