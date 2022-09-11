import { findRouteMatch } from "./hooks/useMatchProjectRoot";
import { ScopeParameter } from "./types";

export type RouteName =
  | "projects"
  | "projectSettings"
  | "pipeline"
  | "jupyterLab"
  | "filePreview"
  | "environments"
  | "jobs"
  | "job"
  | "jobRun"
  | "jobRunFilePreview"
  | "pipelineReadonly"
  | "editJob"
  | "fileManager"
  | "settings"
  | "notificationSettings"
  | "configureJupyterLab"
  | "update"
  | "manageUsers"
  | "help"
  | "notFound";

export type RouteData = {
  path: string;
  root?: string;
  order: number;
  /** Which query-parameters are relevant for this route. */
  scope: ScopeParameter[];
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
      scope: [],
    },
    {
      name: "projectSettings",
      path: "/project-settings",
      root: "/projects",
      title: getTitle("Project Settings"),
      scope: ["projectUuid"],
    },
    {
      name: "pipeline",
      path: "/pipeline",
      title: getTitle("Pipeline"),
      scope: ["projectUuid", "pipelineUuid"],
    },
    {
      name: "jupyterLab",
      path: "/jupyter-lab",
      title: getTitle("JupyterLab"),
      scope: ["projectUuid", "pipelineUuid"],
    },
    {
      name: "filePreview",
      path: "/file-preview",
      root: "/pipeline",
      title: getTitle("Step File Preview"),
      scope: ["projectUuid", "pipelineUuid"],
    },
    {
      name: "logs",
      path: "/logs",
      root: "/pipeline",
      title: getTitle("Logs"),
      scope: ["projectUuid", "pipelineUuid"],
    },
    {
      name: "environments",
      path: "/environments",
      title: getTitle("Environments"),
      scope: ["projectUuid"],
    },
    {
      name: "jobs",
      path: "/jobs",
      title: getTitle("Jobs"),
      scope: ["projectUuid"],
    },
    {
      name: "job",
      path: "/job",
      root: "/jobs",
      title: getTitle("Job"),
      scope: ["projectUuid", "jobUuid"],
    },
    {
      name: "jobRun",
      path: "/job-run",
      root: "/jobs",
      title: getTitle("Job Run"),
      scope: ["projectUuid", "jobRunUuid", "pipelineUuid"],
    },
    {
      name: "jobRunLogs",
      path: "/job-run/logs",
      root: "/jobs",
      title: getTitle("Job Run Logs"),
      scope: ["projectUuid", "jobRunUuid", "pipelineUuid"],
    },
    {
      name: "jobRunFilePreview",
      path: "/job-run/file-preview",
      root: "/jobs",
      title: getTitle("Job Run Step File Preview"),
      scope: ["projectUuid", "jobRunUuid", "pipelineUuid"],
    },
    {
      name: "settings",
      path: "/settings",
      title: getTitle("Settings"),
      scope: [],
    },
    {
      name: "notificationSettings",
      path: "/notification-settings",
      root: "/settings",
      title: getTitle("Notification Settings"),
      scope: [],
    },
    {
      name: "configureJupyterLab",
      path: "/configure-jupyter-lab",
      root: "/settings",
      title: getTitle("Configure JupyterLab"),
      scope: [],
    },
    {
      name: "update",
      path: "/update",
      root: "/settings",
      title: getTitle("Update"),
      scope: [],
    },
    {
      name: "manageUsers",
      path: "/manage-users",
      root: "/settings",
      title: getTitle("Manage Users"),
      scope: [],
    },
    {
      name: "help",
      path: "/help",
      title: getTitle("Help"),
      scope: [],
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
      scope: curr.scope,
      order: i,
    } as RouteData,
  }),
  {} as Record<RouteName, RouteData>
);

const projectRootPaths = [
  siteMap.pipeline.path,
  siteMap.jupyterLab.path,
  siteMap.jobs.path,
  siteMap.environments.path,
];

const navigationPaths = [
  ...projectRootPaths,
  siteMap.settings.path,
  siteMap.help.path,
];

export const getRoutes = (
  predicates: (routeData: Pick<RouteData, "path" | "root">) => boolean
) => {
  return getOrderedRoutes().reduce<Pick<RouteData, "path" | "root">[]>(
    (all, curr) => {
      if (predicates(curr)) {
        return [...all, { path: curr.path, root: curr.root }];
      }
      return all;
    },
    [] as Pick<RouteData, "path" | "root">[]
  );
};

export const navigationRoutes = getRoutes((routeData) => {
  return (
    navigationPaths.includes(routeData.path) ||
    navigationPaths.includes(routeData.root || "")
  );
});

export const withinProjectRoutes = getRoutes((routeData) => {
  return (
    projectRootPaths.includes(routeData.path) ||
    projectRootPaths.includes(routeData.root || "")
  );
});

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
  siteMap.projectSettings.path,
  siteMap.jupyterLab.path,
  siteMap.filePreview.path,
  siteMap.job.path,
];

// used in CommandPalette
export const getPageCommands = (projectUuid: string | undefined) =>
  getOrderedRoutes((title: string) => title)
    .filter((route) => !excludedPaths.includes(route.path))
    .map((route) => {
      const match = findRouteMatch(withinProjectRoutes);
      const query: Record<string, string> =
        match && projectUuid ? { projectUuid } : {};

      return {
        title: `Page: ${route.title}`,
        action: "openPage",
        data: {
          path: route.path,
          query,
        },
      };
    });
