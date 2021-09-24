import { Redirect, Route, Switch } from "react-router-dom";
import { orderedRoutes, siteMap, toQueryString } from "./routingConfig";

import React from "react";
import { useLocation } from "react-router-dom";
import { useOrchest } from "@/hooks/orchest";

const Routes = () => {
  let location = useLocation();
  const context = useOrchest();

  React.useEffect(() => {
    /*
      Always unset the pipeline for the header bar on navigation. 
      It's up to pages to request the headerbar pipeline if they 
      need it.

      TODO: move to HeaderBar in the future.
    */
    context.dispatch({
      type: "pipelineSet",
      payload: {
        pipelineUuid: undefined,
        pipelineName: undefined,
      },
    });
  }, [location]);

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
