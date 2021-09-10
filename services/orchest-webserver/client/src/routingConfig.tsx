import React from "react";

import ConfigureJupyterLabView from "./views/ConfigureJupyterLabView";
import EditJobView from "./views/EditJobView";
import EnvironmentEditView from "./views/EnvironmentEditView";
import EnvironmentsView from "./views/EnvironmentsView";
import FileManagerView from "./views/FileManagerView";
import FilePreviewView from "./views/FilePreviewView";
import HelpView from "./views/HelpView";
import JobView from "./views/JobView";
import JobsView from "./views/JobsView";
import JupyterLabView from "./views/JupyterLabView";
import LogsView from "./pipeline-view/LogsView";
import ManageUsersView from "./views/ManageUsersView";
import PipelineSettingsView from "./views/PipelineSettingsView";
import PipelineView from "./pipeline-view/PipelineView";
import PipelinesView from "./views/PipelinesView";
import ProjectSettingsView from "./views/ProjectSettingsView";
import ProjectsView from "./views/ProjectsView";
import SettingsView from "./views/SettingsView";
import UpdateView from "./views/UpdateView";

type RouteName =
  | "projects"
  | "projectSettings"
  | "pipelines"
  | "pipeline"
  | "jupyterLab"
  | "pipelineSettings"
  | "filePreview"
  | "logs"
  | "environments"
  | "environment"
  | "jobs"
  | "job"
  | "pipelineReadonly"
  | "jobEdit"
  | "fileManager"
  | "settings"
  | "configureJupyterLab"
  | "update"
  | "manageUsers"
  | "help"
  | "notFound";

type RouteData = {
  path: string;
  component: React.FunctionComponent;
  order: number;
};

//       window.document.title =
//         pascalCaseToCapitalized(viewName.replace("View", "")) + " · Orchest";

const getTitle = (pageTitle: string) => `${pageTitle} · Orchest`;

// this type is part of react-router, which is the dependency of react-router-dom
// we simply declare the type here, without install @types/react-router
interface StaticContext {
  statusCode?: number;
}

// this is the central place where we maintain all the FE routes
// to add new route, you would also need to add the route name to RouteName.
// NOTE: the order of the routes matters, react-router loads the first route that matches the given path

/* eslint-disable react/display-name */

export const orderedRoutes: {
  name: RouteName;
  path: string;
  component: React.FunctionComponent;
  title: string;
}[] = [
  {
    name: "projects",
    path: "/projects",
    title: getTitle("Projects"),
    component: ProjectsView,
  },
  {
    name: "projectSettings",
    path: "/projects/:projectId/settings",
    title: getTitle("Project Settings"),
    component: ProjectSettingsView,
  },
  {
    name: "pipelines",
    path: "/projects/:projectId/pipelines",
    title: getTitle("Pipelines"),
    component: PipelinesView,
  },
  {
    name: "pipeline",
    path: "/projects/:projectId/pipelines/:pipelineId",
    title: getTitle("Pipeline"),
    component: PipelineView,
  },
  {
    name: "jupyterLab",
    path: "/projects/:projectId/pipelines/:pipelineId/jupyter-lab",
    title: getTitle("JupyterLab"),
    component: JupyterLabView,
  },
  {
    name: "pipelineSettings",
    path: "/projects/:projectId/pipelines/:pipelineId/settings",
    title: getTitle("Pipeline Settings"),
    component: PipelineSettingsView,
  },
  {
    name: "filePreview",
    path: "/projects/:projectId/pipelines/:pipelineId/steps/:stepId/file",
    title: getTitle("Step File Preview"),
    component: FilePreviewView,
  },
  {
    name: "logs",
    path: "/projects/:projectId/pipelines/:pipelineId/logs",
    title: getTitle("Logs"),
    component: LogsView,
  },
  {
    name: "environments",
    path: "/projects/:projectId/environments",
    title: getTitle("Environments"),
    component: EnvironmentsView,
  },
  {
    name: "environment",
    path: "/projects/:projectId/environments/:environmentId",
    title: getTitle("Environment"),
    component: EnvironmentEditView,
  },
  {
    name: "jobs",
    path: "/projects/:projectId/jobs",
    title: getTitle("Jobs"),
    component: JobsView,
  },
  {
    name: "job",
    path: "/projects/:projectId/jobs/:jobId",
    title: getTitle("Job"),
    component: JobView,
  },
  {
    name: "jobEdit",
    path: "/projects/:projectId/jobs/:jobId/edit",
    title: getTitle("Edit Job"),
    component: EditJobView,
  },
  {
    name: "fileManager",
    path: "/file-manager",
    title: getTitle("File Manager"),
    component: FileManagerView,
  },
  {
    name: "settings",
    path: "/settings",
    title: getTitle("Settings"),
    component: SettingsView,
  },
  {
    name: "configureJupyterLab",
    path: "/settings/configure-jupyter-lab",
    title: getTitle("Configure JupyterLab"),
    component: ConfigureJupyterLabView,
  },
  {
    name: "update",
    path: "/settings/update",
    title: getTitle("Update"),
    component: UpdateView,
  },
  {
    name: "manageUsers",
    path: "/settings/manage-users",
    title: getTitle("Manage Users"),
    component: ManageUsersView,
  },
  {
    name: "help",
    path: "/help",
    title: getTitle("Help"),
    component: HelpView,
  },
  // TODO: we need a proper PageNotFound page, atm we redirect back to ProjectsView
  // // will always be the last one as a fallback
  // {
  //   name: "notFound",
  //   path: "*",
  //   title: getTitle("Page Not Found"),
  //   component: NotFound,
  // },
];

/* eslint-enable react/display-name */

export const siteMap = orderedRoutes.reduce<Record<RouteName, RouteData>>(
  (all, curr, i) => ({
    ...all,
    [curr.name]: {
      path: curr.path,
      component: curr.component,
      order: i,
    } as RouteData,
  }),
  {} as Record<RouteName, RouteData>
);

const snakeCase = (str: string) =>
  str
    .split(/(?=[A-Z])/)
    .join("_")
    .toLowerCase();

export const toQueryString = <T extends string>(
  query: Record<T, string | number | boolean | undefined | null>
) => {
  const isObject =
    typeof query === "object" &&
    query !== null &&
    typeof query !== "function" &&
    !Array.isArray(query);
  return isObject
    ? Object.entries<string | number | boolean | undefined | null>(query)
        .reduce((str, entry) => {
          const [key, value] = entry;
          return value // we don't pass along null or undefined since it doesn't mean much to the receiver
            ? `${str}${snakeCase(key)}=${value.toString().toLowerCase()}&`
            : str;
        }, "?")
        .slice(0, -1) // remove the trailing '&' or '?'.
    : "";
};

export const generatePathFromRoute = <T extends string>(
  route: string,
  pathParams: Record<T, string | number | boolean | null | undefined>
) => {
  // replace the route params with the given object key-value pairs
  return Object.entries<string | number | boolean | null | undefined>(
    pathParams
  ).reduce((str, param) => {
    const [key, value] = param;
    return str.replace(`:${key}`, !!value ? value.toString() : "");
  }, route);
};
