import { EnvironmentState } from "@/types";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ReplayOutlinedIcon from "@mui/icons-material/ReplayOutlined";
import CircularProgress from "@mui/material/CircularProgress";
import React from "react";
import { isEnvironmentBuilding, isEnvironmentFailedToBuild } from "./common";

type BuildStatusIconProps = {
  latestBuild?: EnvironmentState["latestBuild"];
};

export const BuildStatusIcon = ({ latestBuild }: BuildStatusIconProps) => {
  if (latestBuild?.status === "SUCCESS")
    return <CheckCircleOutlineOutlinedIcon fontSize="small" color="success" />;
  if (isEnvironmentBuilding(latestBuild)) return <CircularProgress size={20} />;
  if (isEnvironmentFailedToBuild(latestBuild))
    return <CancelOutlinedIcon fontSize="small" color="error" />;
  if (latestBuild?.status === "PAUSED")
    return <ReplayOutlinedIcon fontSize="small" />;

  return <EditOutlinedIcon fontSize="small" color="action" />;
};
