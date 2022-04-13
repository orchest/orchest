import React from "react";
import EditJobView from "./edit-job-view/EditJobView";
import EnvironmentEditView from "./environment-edit-view/EnvironmentEditView";
import JobView from "./job-view/JobView";
import JobsView from "./jobs-view/JobsView";
import PipelineSettingsView from "./pipeline-settings-view/PipelineSettingsView";
import LogsView from "./pipeline-view/LogsView";
import PipelineView from "./pipeline-view/PipelineView";
import ExamplesView from "./projects-view/ExamplesView";
import ProjectsView from "./projects-view/ProjectsView";
import ConfigureJupyterLabView from "./views/ConfigureJupyterLabView";
import EnvironmentsView from "./views/EnvironmentsView";
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
  | "pipeline"
  | "jupyterLab"
  | "pipelineSettings"
  | "filePreview"
  | "logs"
  | "environments"
  | "environment"
  | "jobs"
  | "job"
  | "jobRun"
  | "jobRunPipelineSettings"
  | "jobRunLogs"
  | "jobRunFilePreview"
  | "pipelineReadonly"
  | "editJob"
  | "fileManager"
  | "settings"
  | "configureJupyterLab"
  | "update"
  | "manageUsers"
  | "help"
  | "notFound";

export type RouteData = {
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
      name: "pipeline",
      path: "/pipeline",
      title: getTitle("Pipeline"),
      component: PipelineView,
    },
    {
      name: "jupyterLab",
      path: "/jupyter-lab",
      root: "/pipeline",
      title: getTitle("JupyterLab"),
      component: JupyterLabView,
    },
    {
      name: "pipelineSettings",
      path: "/pipeline-settings",
      root: "/pipeline",
      title: getTitle("Pipeline Settings"),
      component: PipelineSettingsView,
    },
    {
      name: "filePreview",
      path: "/file-preview",
      root: "/pipeline",
      title: getTitle("Step File Preview"),
      component: FilePreviewView,
    },
    {
      name: "logs",
      path: "/logs",
      root: "/pipeline",
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
      name: "jobRun",
      path: "/job-run",
      root: "/jobs",
      title: getTitle("Job Run"),
      component: PipelineView,
    },
    {
      name: "jobRunPipelineSettings",
      path: "/job-run/pipeline-settings",
      root: "/jobs",
      title: getTitle("Job Run Pipeline Settings"),
      component: PipelineSettingsView,
    },
    {
      name: "jobRunLogs",
      path: "/job-run/logs",
      root: "/jobs",
      title: getTitle("Job Run Logs"),
      component: LogsView,
    },
    {
      name: "jobRunFilePreview",
      path: "/job-run/file-preview",
      root: "/jobs",
      title: getTitle("Job Run Step File Preview"),
      component: FilePreviewView,
    },
    {
      name: "editJob",
      path: "/edit-job",
      root: "/jobs",
      title: getTitle("Edit Job"),
      component: EditJobView,
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

export const projectRootPaths = [
  siteMap.jobs.path,
  siteMap.environments.path,
  siteMap.pipeline.path,
];

export const withinProjectPaths = getOrderedRoutes().reduce<
  Pick<RouteData, "path" | "root">[]
>((all, curr) => {
  // only include within-project paths
  // i.e. if the context involves multiple projects, it should be excluded
  if (
    projectRootPaths.includes(curr.path) ||
    projectRootPaths.includes(curr.root || "") ||
    curr.path === "/project"
    // projectsPaths.includes(curr.path)
  ) {
    return [
      ...all,
      {
        path: curr.path,
        root: curr.root,
      },
    ];
  }
  return all;
}, [] as Pick<RouteData, "path" | "root">[]);

const snakeCase = (str: string, divider = "_") =>
  str
    .split(/(?=[A-Z])/)
    .join(divider)
    .toLowerCase();

export const toQueryString = <T extends string>(
  query: Record<T, string | number | boolean | undefined | null> | null
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
          const encodedValue =
            value && value !== "null" && value !== "undefined" // we don't pass along null or undefined since it doesn't mean much to the receiver
              ? encodeURIComponent(value.toString())
              : null;
          return encodedValue
            ? `${str}${snakeCase(key)}=${encodedValue}&`
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

// Exclude detail views
const excludedPaths = [
  siteMap.pipeline.path,
  siteMap.environment.path,
  siteMap.pipelineSettings.path,
  siteMap.projectSettings.path,
  siteMap.jupyterLab.path,
  siteMap.filePreview.path,
  siteMap.logs.path,
  siteMap.job.path,
  siteMap.editJob.path,
];

// used in CommandPalette
export const pageCommands = getOrderedRoutes((title: string) => title)
  .filter((route) => !excludedPaths.includes(route.path))
  .map((route) => {
    return {
      title: "Page: " + route.title,
      action: "openPage",
      data: { path: route.path, query: {} },
    };
  });
