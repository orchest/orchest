import { siteMap } from "@/routingConfig";
import { toQueryString } from "@/utils/routing";
import React from "react";

export type NavItem = {
  label: string;
  icon?: React.ReactElement;
  path: string;
};

export const getProjectMenuItems = (
  projectUuid: string | undefined,
  pipelineUuid: string | undefined
): NavItem[] => {
  const queryString = projectUuid
    ? toQueryString({ projectUuid, pipelineUuid })
    : "";
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
