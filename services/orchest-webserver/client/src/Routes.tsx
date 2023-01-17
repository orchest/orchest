import React from "react";
import { Redirect, Route, Switch, useLocation } from "react-router-dom";
import { ConfigureGitSshView } from "./config-git-ssh-view/ConfigureGitSshView";
import ConfigureJupyterLabView from "./config-jupyterlab-view/ConfigureJupyterLabView";
import { EnvironmentsView } from "./environments-view/EnvironmentsView";
import { HomeView } from "./home-view/HomeView";
import { JobsView } from "./jobs-view/JobsView";
import { NotificationSettingsView } from "./notification-settings-view/NotificationSettingsView";
import PipelineView from "./pipeline-view/PipelineView";
import { getOrderedRoutes, siteMap } from "./routingConfig";
import { SettingsView } from "./settings-view/SettingsView";
import HelpView from "./views/HelpView";
import JupyterLabView from "./views/JupyterLabView";
import ManageUsersView from "./views/ManageUsersView";
import ProjectSettingsView from "./views/ProjectSettingsView";
import UpdateView from "./views/UpdateView";

// View components are imported here instead of routingConfig.
// `siteMap` is used by navigateTo, which is used in many places.
// It should not be in the file that imports many other components.
// It will make it very difficult for unit testing
const pathComponentMapping = {
  "/project-settings": ProjectSettingsView,
  "/pipeline": PipelineView,
  "/jupyter-lab": JupyterLabView,
  "/file-preview": PipelineView,
  "/environments": EnvironmentsView,
  "/jobs": JobsView,
  "/job-run": PipelineView,
  "/job-run/file-preview": PipelineView,
  "/settings": SettingsView,
  "/notification-settings": NotificationSettingsView,
  "/configure-jupyter-lab": ConfigureJupyterLabView,
  "/configure-git-ssh": ConfigureGitSshView,
  "/update": UpdateView,
  "/manage-users": ManageUsersView,
  "/help": HelpView,
  "/": HomeView,
  //  "*": NotFound,
};

const Routes = () => {
  let location = useLocation();

  return (
    <Switch>
      {getOrderedRoutes().map((route) => {
        const { name, path, title } = route;
        const shouldBeExact = name !== "notFound"; // notFound uses * as a fallback, it cannot be exact

        return (
          <Route
            exact={shouldBeExact}
            key={`${path}-${location.search}`}
            path={path}
            render={() => {
              window.document.title = title;
              const Component = pathComponentMapping[path];
              return <Component />;
            }}
          />
        );
      })}
      <Route path="*">
        <Redirect to={siteMap.home.path} />
      </Route>
    </Switch>
  );
};

export { Routes };
