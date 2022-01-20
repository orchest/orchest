import { hasValue } from "@orchest/lib-utils";
import React from "react";
import EditJobView from "./edit-job-view/EditJobView";
import JobView from "./job-view/JobView";
import JobsView from "./jobs-view/JobsView";
import PipelineSettingsView from "./pipeline-settings-view/PipelineSettingsView";
import LogsView from "./pipeline-view/LogsView";
import PipelineView from "./pipeline-view/PipelineView";
import PipelinesView from "./pipelines-view/PipelinesView";
import ExamplesView from "./projects-view/ExamplesView";
import ProjectsView from "./projects-view/ProjectsView";
import ConfigureJupyterLabView from "./views/ConfigureJupyterLabView";
import EnvironmentEditView from "./views/EnvironmentEditView";
import EnvironmentsView from "./views/EnvironmentsView";
import FileManagerView from "./views/FileManagerView";
import FilePreviewView from "./views/FilePreviewView";
import HelpView from "./views/HelpView";
import JupyterLabView from "./views/JupyterLabView";
import ManageUsersView from "./views/ManageUsersView";
import ProjectSettingsView from "./views/ProjectSettingsView";
import SettingsView from "./views/SettingsView";
import UpdateView from "./views/UpdateView";

type RouteName =
  | "projects"
  | "examples"
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
  root?: string;
  component: React.FunctionComponent;
  order: number;
};

const _getTitle = (pageTitle: string) => `${pageTitle} · Orchest`;

// this is the central place where we maintain all the FE routes
// to add new route, you would also need to add the route name to RouteName.
// NOTE: the order of the routes matters, react-router loads the first route that matches the given path

export const getOrderedRoutes = (getTitle?: (props: unknown) => string) => {
  if (getTitle === undefined) {
    getTitle = _getTitle;
  }
  return [
    {
      name: "projects",
      path: "/projects",
      title: getTitle("Projects"),
      component: ProjectsView,
    },
    {
      name: "examples",
      path: "/examples",
      root: "/projects",
      title: getTitle("Examples"),
      component: ExamplesView,
    },
    {
      name: "projectSettings",
      path: "/project-settings",
      root: "/projects",
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
      root: "/pipelines",
      title: getTitle("Pipeline"),
      component: PipelineView,
    },
    {
      name: "jupyterLab",
      path: "/jupyter-lab",
      root: "/pipelines",
      title: getTitle("JupyterLab"),
      component: JupyterLabView,
    },
    {
      name: "pipelineSettings",
      path: "/pipeline-settings",
      root: "/pipelines",
      title: getTitle("Pipeline Settings"),
      component: PipelineSettingsView,
    },
    {
      name: "filePreview",
      path: "/file-preview",
      root: "/pipelines",
      title: getTitle("Step File Preview"),
      component: FilePreviewView,
    },
    {
      name: "logs",
      path: "/logs",
      root: "/pipelines",
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
      root: "/environments",
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
      root: "/jobs",
      title: getTitle("Job"),
      component: JobView,
    },
    {
      name: "editJob",
      path: "/edit-job",
      root: "/jobs",
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
      root: "/settings",
      title: getTitle("Configure JupyterLab"),
      component: ConfigureJupyterLabView,
    },
    {
      name: "update",
      path: "/update",
      root: "/settings",
      title: getTitle("Update"),
      component: UpdateView,
    },
    {
      name: "manageUsers",
      path: "/manage-users",
      root: "/settings",
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
};

export const siteMap = getOrderedRoutes().reduce<Record<RouteName, RouteData>>(
  (all, curr, i) => ({
    ...all,
    [curr.name]: {
      path: curr.path,
      root: curr.root,
      component: curr.component,
      order: i,
    } as RouteData,
  }),
  {} as Record<RouteName, RouteData>
);

const snakeCase = (str: string, divider = "_") =>
  str
    .split(/(?=[A-Z])/)
    .join(divider)
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
          return hasValue(value) // we don't pass along null or undefined since it doesn't mean much to the receiver
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
