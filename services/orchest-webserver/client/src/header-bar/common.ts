import { siteMap } from "@/routingConfig";
import { toQueryString } from "@/utils/routing";

export type NavItem = { label: string; path: string };

export const getProjectMenuItems = (
  projectUuid: string | undefined
): NavItem[] => {
  const queryString = projectUuid ? toQueryString({ projectUuid }) : "";
  return [
    {
      label: "Pipelines",
      path: `${siteMap.pipeline.path}${queryString}`,
    },
    {
      label: "JupyterLab",
      path: `${siteMap.jupyterLab.path}${queryString}`,
    },
    {
      label: "Jobs",
      path: `${siteMap.jobs.path}${queryString}`,
    },
    {
      label: "Environments",
      path: `${siteMap.environments.path}${queryString}`,
    },
  ];
};
