import { useCheckUpdate } from "@/hooks/useCheckUpdate";
import React from "react";
import { Redirect, Route, Switch, useLocation } from "react-router-dom";
import { getOrderedRoutes, siteMap, toQueryString } from "./routingConfig";

const Routes = () => {
  let location = useLocation();
  // const routesCheckingUpdate = ["projects", "settings", "help"];

  // if (routesCheckingUpdate.includes(name)) {
  // TODO: It now runs on all routes, but it should only display on
  // the routes defined by routesCheckingUpdate
  useCheckUpdate();

  return (
    <Switch>
      <Route exact path="/">
        <Redirect to={siteMap.projects.path} />
      </Route>
      {getOrderedRoutes().map((route) => {
        const { name, path, component, title } = route;
        const shouldBeExact = name !== "notFound"; // notFound uses * as a fallback, it cannot be exact

        return (
          <Route
            exact={shouldBeExact}
            key={`${path}-${location.search}`}
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
