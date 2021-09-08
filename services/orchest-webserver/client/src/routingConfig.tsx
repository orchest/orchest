import React from "react";

import EnvironmentEditView from "./views/EnvironmentEditView";
import EnvironmentsView from "./views/EnvironmentsView";
import FilePreviewView from "./views/FilePreviewView";
import JobView from "./views/JobView";
import JobsView from "./views/JobsView";
import JupyterLabView from "./views/JupyterLabView";
import LogsView from "./pipeline-view/LogsView";
import { NotFound } from "./views/NotFound";
import PipelineSettingsView from "./views/PipelineSettingsView";
import PipelineView from "./pipeline-view/PipelineView";
import PipelinesView from "./views/PipelinesView";
import ProjectsView from "./views/ProjectsView";
import ProjectSettingsView from "./views/ProjectSettingsView";
import HelpView from "./views/HelpView";
import FileManagerView from "./views/FileManagerView";
import SettingsView from "./views/SettingsView";
import UpdateView from "./views/UpdateView";
import ConfigureJupyterLabView from "./views/ConfigureJupyterLabView";
import ManageUsersView from "./views/ManageUsersView";

const Foo = () => <div>Foo</div>;

type RouteName =
  | "projects"
  | "project"
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
// this is the central place where we maintain all the FE routes
// to add new route, you would also need to add the route name to RouteName.
// NOTE: the order of the routes matters, react-router loads the first route that matches the given path
export const orderedRoutes: {
  name: RouteName;
  path: string;
  component: React.FunctionComponent;
}[] = [
  {
    name: "projects",
    path: "/projects",
    component: ProjectsView,
  },
  {
    name: "project",
    path: "/projects/:projectId/settings",
    component: ProjectSettingsView,
  },
  {
    name: "pipelines",
    path: "/projects/:projectId/pipelines",
    component: PipelinesView,
  },
  {
    name: "pipeline",
    path: "/projects/:projectId/pipelines/:pipelineId",
    component: PipelineView,
  },
  {
    name: "jupyterLab",
    path: "/projects/:projectId/pipelines/:pipelineId/jupyter-lab",
    component: JupyterLabView,
  },
  {
    name: "pipelineSettings",
    path: "/projects/:projectId/pipelines/:pipelineId/settings",
    component: PipelineSettingsView,
  },
  {
    name: "filePreview",
    path: "/projects/:projectId/pipelines/:pipelineId/steps/:stepId/file",
    component: FilePreviewView, // why do job_uuid and run_uuid matters in this context?
  },
  {
    name: "logs",
    path: "/projects/:projectId/pipelines/:pipelineId/logs",
    component: LogsView,
  },
  // --------finish line
  {
    name: "environments",
    path: "/projects/:projectId/environments",
    component: EnvironmentsView,
  },
  {
    name: "environment",
    path: "/projects/:projectId/environments/:environmentId",
    component: EnvironmentEditView,
  },
  {
    name: "jobs",
    path: "/projects/:projectId/jobs",
    component: JobsView,
  },
  {
    name: "job",
    path: "/projects/:projectId/jobs/:jobId",
    component: JobView,
  },
  {
    name: "fileManager",
    path: "/file-manager",
    component: FileManagerView,
  },
  {
    name: "settings",
    path: "/settings",
    component: SettingsView,
  },
  {
    name: "configureJupyterLab",
    path: "/settings/configure-jupyter-lab",
    component: ConfigureJupyterLabView,
  },
  {
    name: "update",
    path: "/settings/update",
    component: UpdateView,
  },
  {
    name: "manageUsers",
    path: "/settings/manage-users",
    component: ManageUsersView,
  },
  {
    name: "help",
    path: "/help",
    component: HelpView,
  },
  // will always be the last one as a fallback
  {
    name: "notFound",
    path: "*",
    component: NotFound,
  },
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
  query: Record<T, string | number | boolean>
) => {
  const isObject =
    typeof query === "object" &&
    query !== null &&
    typeof query !== "function" &&
    !Array.isArray(query);
  return isObject
    ? Object.entries(query)
        .reduce((str, [key, value]) => {
          return `${str}${snakeCase(key)}=${value}&`;
        }, "?")
        .slice(0, -1)
    : "";
};

export const generatePathFromRoute = <T extends string>(
  route: string,
  pathParams: Record<T, string | number | boolean | undefined>
) => {
  // replace the route params with the given object key value pairs
  return Object.entries(pathParams).reduce(
    (str, param: [string, string | number | boolean | undefined]) => {
      const [key, value] = param;
      return str.replace(`:${key}`, value ? value.toString() : "");
    },
    route
  );
};
