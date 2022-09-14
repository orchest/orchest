import {
  StatusIcon,
  StatusIconStatus,
} from "@/components/Layout/layout-with-side-panel/StatusIcon";
import { EnvironmentImageBuild } from "@/types";
import React from "react";
import { isEnvironmentBuilding, isEnvironmentFailedToBuild } from "./common";

type BuildStatusIconProps = {
  latestBuildStatus?: EnvironmentImageBuild["status"];
};

const getBuildStatusIconStatus = (
  latestBuildStatus?: EnvironmentImageBuild["status"]
): StatusIconStatus => {
  if (latestBuildStatus === "SUCCESS") return "SUCCESS";
  if (latestBuildStatus === "PAUSED") return "PAUSED";
  if (isEnvironmentBuilding(latestBuildStatus)) return "IN_PROGRESS";
  if (isEnvironmentFailedToBuild(latestBuildStatus)) return "ERROR";
  return "DRAFT";
};

export const BuildStatusIcon = ({
  latestBuildStatus,
}: BuildStatusIconProps) => {
  return <StatusIcon status={getBuildStatusIconStatus(latestBuildStatus)} />;
};
