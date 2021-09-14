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
  | "editJob"
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

const getTitle = (pageTitle: string) => `${pageTitle} · Orchest`;

// this is the central place where we maintain all the FE routes
// to add new route, you would also need to add the route name to RouteName.
// NOTE: the order of the routes matters, react-router loads the first route that matches the given path

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
    path: "/project-settings",
    title: getTitle("Project Settings"),
    component: ProjectSettingsView,
  },
  {
    name: "pipelines",
    path: "/pipelines",
    title: getTitle("Pipelines"),
    component: PipelinesView,
  },
  {
    name: "pipeline",
    path: "/pipeline",
    title: getTitle("Pipeline"),
    component: PipelineView,
  },
  {
    name: "jupyterLab",
    path: "/jupyter-lab",
    title: getTitle("JupyterLab"),
    component: JupyterLabView,
  },
  {
    name: "pipelineSettings",
    path: "/pipeline-settings",
    title: getTitle("Pipeline Settings"),
    component: PipelineSettingsView,
  },
  {
    name: "filePreview",
    path: "/file-preview",
    title: getTitle("Step File Preview"),
    component: FilePreviewView,
  },
  {
    name: "logs",
    path: "/logs",
    title: getTitle("Logs"),
    component: LogsView,
  },
  {
    name: "environments",
    path: "/environments",
    title: getTitle("Environments"),
    component: EnvironmentsView,
  },
  {
    name: "environment",
    path: "/environment",
    title: getTitle("Environment"),
    component: EnvironmentEditView,
  },
  {
    name: "jobs",
    path: "/jobs",
    title: getTitle("Jobs"),
    component: JobsView,
  },
  {
    name: "job",
    path: "/job",
    title: getTitle("Job"),
    component: JobView,
  },
  {
    name: "editJob",
    path: "/edit-job",
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
    path: "/configure-jupyter-lab",
    title: getTitle("Configure JupyterLab"),
    component: ConfigureJupyterLabView,
  },
  {
    name: "update",
    path: "/update",
    title: getTitle("Update"),
    component: UpdateView,
  },
  {
    name: "manageUsers",
    path: "/manage-users",
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
    const isValueValid = value !== undefined && value !== null;
    return str.replace(`:${key}`, isValueValid ? value.toString() : "");
  }, route);
};
