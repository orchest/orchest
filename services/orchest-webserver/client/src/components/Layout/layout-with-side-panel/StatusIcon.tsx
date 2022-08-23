import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ReplayOutlinedIcon from "@mui/icons-material/ReplayOutlined";
import CircularProgress from "@mui/material/CircularProgress";
import React from "react";

export type StatusIconStatus =
  | "SUCCESS"
  | "IN_PROGRESS"
  | "ERROR"
  | "PAUSED"
  | "DRAFT";

type StatusIconProps = {
  status: StatusIconStatus;
};

export const statusIconDefaultProps = {
  fontSize: "small" as const,
};

export const StatusIcon = ({ status }: StatusIconProps) => {
  if (status === "SUCCESS")
    return (
      <CheckCircleOutlineOutlinedIcon
        {...statusIconDefaultProps}
        color="success"
      />
    );
  if (status === "IN_PROGRESS") return <CircularProgress size={20} />;
  if (status === "ERROR")
    return <CancelOutlinedIcon {...statusIconDefaultProps} color="error" />;
  if (status === "PAUSED")
    return <ReplayOutlinedIcon {...statusIconDefaultProps} />;

  return <EditOutlinedIcon {...statusIconDefaultProps} color="action" />;
};
