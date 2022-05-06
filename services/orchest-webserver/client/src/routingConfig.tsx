import React from "react";

export type RouteName =
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

export const getOrderedRoutes = (getTitle = _getTitle) => {
  return [
    {
      name: "projects",
      path: "/projects",
      title: getTitle("Projects"),
    },
    {
      name: "examples",
      path: "/examples",
      root: "/projects",
      title: getTitle("Examples"),
    },
    {
      name: "projectSettings",
      path: "/project-settings",
      root: "/projects",
      title: getTitle("Project Settings"),
    },
    {
      name: "pipeline",
      path: "/pipeline",
      title: getTitle("Pipeline"),
    },
    {
      name: "jupyterLab",
      path: "/jupyter-lab",
      root: "/pipeline",
      title: getTitle("JupyterLab"),
    },
    {
      name: "pipelineSettings",
      path: "/pipeline-settings",
      root: "/pipeline",
      title: getTitle("Pipeline Settings"),
    },
    {
      name: "filePreview",
      path: "/file-preview",
      root: "/pipeline",
      title: getTitle("Step File Preview"),
    },
    {
      name: "logs",
      path: "/logs",
      root: "/pipeline",
      title: getTitle("Logs"),
    },
    {
      name: "environments",
      path: "/environments",
      title: getTitle("Environments"),
    },
    {
      name: "environment",
      path: "/environment",
      root: "/environments",
      title: getTitle("Environment"),
    },
    {
      name: "jobs",
      path: "/jobs",
      title: getTitle("Jobs"),
    },
    {
      name: "job",
      path: "/job",
      root: "/jobs",
      title: getTitle("Job"),
    },
    {
      name: "jobRun",
      path: "/job-run",
      root: "/jobs",
      title: getTitle("Job Run"),
    },
    {
      name: "jobRunPipelineSettings",
      path: "/job-run/pipeline-settings",
      root: "/jobs",
      title: getTitle("Job Run Pipeline Settings"),
    },
    {
      name: "jobRunLogs",
      path: "/job-run/logs",
      root: "/jobs",
      title: getTitle("Job Run Logs"),
    },
    {
      name: "jobRunFilePreview",
      path: "/job-run/file-preview",
      root: "/jobs",
      title: getTitle("Job Run Step File Preview"),
    },
    {
      name: "editJob",
      path: "/edit-job",
      root: "/jobs",
      title: getTitle("Edit Job"),
    },
    {
      name: "settings",
      path: "/settings",
      title: getTitle("Settings"),
    },
    {
      name: "configureJupyterLab",
      path: "/configure-jupyter-lab",
      root: "/settings",
      title: getTitle("Configure JupyterLab"),
    },
    {
      name: "update",
      path: "/update",
      root: "/settings",
      title: getTitle("Update"),
    },
    {
      name: "manageUsers",
      path: "/manage-users",
      root: "/settings",
      title: getTitle("Manage Users"),
    },
    {
      name: "help",
      path: "/help",
      title: getTitle("Help"),
    },
    // TODO: we need a proper PageNotFound page, atm we redirect back to ProjectsView
    // // will always be the last one as a fallback
    // {
    //   name: "notFound",
    //   path: "*",
    //   title: getTitle("Page Not Found"),
    // },
  ];
};

export const siteMap = getOrderedRoutes().reduce<Record<RouteName, RouteData>>(
  (all, curr, i) => ({
    ...all,
    [curr.name]: {
      path: curr.path,
      root: curr.root,
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
