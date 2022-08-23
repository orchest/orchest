import {
  StatusIcon,
  StatusIconStatus,
} from "@/components/Layout/layout-with-side-panel/StatusIcon";
import { EnvironmentState } from "@/types";
import React from "react";
import { isEnvironmentBuilding, isEnvironmentFailedToBuild } from "./common";

type BuildStatusIconProps = {
  latestBuild?: EnvironmentState["latestBuild"];
};

const getBuildStatusIconStatus = (
  latestBuild: EnvironmentState["latestBuild"]
): StatusIconStatus => {
  if (latestBuild?.status === "SUCCESS") return "SUCCESS";
  if (latestBuild?.status === "PAUSED") return "PAUSED";
  if (isEnvironmentBuilding(latestBuild)) return "IN_PROGRESS";
  if (isEnvironmentFailedToBuild(latestBuild)) return "ERROR";
  return "DRAFT";
};

export const BuildStatusIcon = ({ latestBuild }: BuildStatusIconProps) => {
  return <StatusIcon status={getBuildStatusIconStatus(latestBuild)} />;
};
