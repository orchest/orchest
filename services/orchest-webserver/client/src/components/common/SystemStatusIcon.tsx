import { StatusFlavor, SystemStatus } from "@/utils/system-status";
import { BlockOutlined } from "@mui/icons-material";
import CheckCircleOutlineOutlined from "@mui/icons-material/CheckCircleOutlineOutlined";
import CircleOutlined from "@mui/icons-material/CircleOutlined";
import ErrorOutlined from "@mui/icons-material/ErrorOutline";
import PauseCircleOutlined from "@mui/icons-material/PauseCircleOutlined";
import ScheduleOutlined from "@mui/icons-material/ScheduleOutlined";
import CircularProgress from "@mui/material/CircularProgress";
import React from "react";

export type SystemStatusIconProps = {
  status?: SystemStatus;
  flavor: StatusFlavor;
  size?: "small" | "medium" | "large";
  animate?: boolean;
};

export type SystemStatusIconSize = "small" | "medium" | "large";

const progressSize: Record<SystemStatusIconSize, number> = {
  small: 18,
  medium: 24,
  large: 30,
};

export const SystemStatusIcon = ({
  status,
  flavor,
  size,
  animate = true,
}: SystemStatusIconProps) => {
  if (status === "SCHEDULED" || (status === "PENDING" && flavor === "job")) {
    return <ScheduleOutlined fontSize={size} />;
  } else if (status === "PENDING" && flavor === "pipeline") {
    return <CircleOutlined fontSize={size} color="action" />;
  } else if (status === "STARTED") {
    return (
      <CircularProgress
        sx={{ marginRight: 0.25 }}
        size={size ? progressSize[size] : undefined}
        variant={animate ? "indeterminate" : "determinate"}
        value={animate ? undefined : 70}
      />
    );
  } else if (status === "SUCCESS") {
    return <CheckCircleOutlineOutlined fontSize={size} color="success" />;
  } else if (status === "ABORTED") {
    return <BlockOutlined fontSize={size} color="warning" />;
  } else if (status === "PAUSED") {
    return <PauseCircleOutlined fontSize={size} color="action" />;
  } else if (status === "FAILURE") {
    return <ErrorOutlined fontSize={size} color="error" />;
  } else {
    return null;
  }
};
