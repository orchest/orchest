import React from "react";
import { Redirect, Route, Switch, useLocation } from "react-router-dom";
import EditJobView from "./edit-job-view/EditJobView";
import EnvironmentEditView from "./environment-edit-view/EnvironmentEditView";
import EnvironmentsView from "./environments-view/EnvironmentsView";
import JobView from "./job-view/JobView";
import JobsView from "./jobs-view/JobsView";
import { NotificationSettingsView } from "./notification-settings-view/NotificationSettingsView";
import PipelineView from "./pipeline-view/PipelineView";
import { ProjectsView } from "./projects-view/ProjectsView";
import { getOrderedRoutes, siteMap } from "./routingConfig";
import SettingsView from "./settings-view/SettingsView";
import ConfigureJupyterLabView from "./views/ConfigureJupyterLabView";
import FilePreviewView from "./views/FilePreviewView";
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
  "/projects": ProjectsView,
  "/project-settings": ProjectSettingsView,
  "/pipeline": PipelineView,
  "/jupyter-lab": JupyterLabView,
  "/file-preview": FilePreviewView,
  "/environments": EnvironmentsView,
  "/environment": EnvironmentEditView,
  "/jobs": JobsView,
  "/job": JobView,
  "/job-run": PipelineView,
  "/job-run/file-preview": FilePreviewView,
  "/edit-job": EditJobView,
  "/settings": SettingsView,
  "/notification-settings": NotificationSettingsView,
  "/configure-jupyter-lab": ConfigureJupyterLabView,
  "/update": UpdateView,
  "/manage-users": ManageUsersView,
  "/help": HelpView,
  //  "*": NotFound,
};

const Routes = () => {
  let location = useLocation();

  return (
    <Switch>
      <Route exact path="/">
        <Redirect to={siteMap.projects.path} />
      </Route>
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
        <Redirect to={siteMap.projects.path} />
      </Route>
    </Switch>
  );
};

export { Routes };
