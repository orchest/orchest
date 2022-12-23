import {
  statusColor,
  StatusFlavor,
  statusTextColor,
  statusTitle,
  SystemStatus,
} from "@/utils/system-status";
import Chip from "@mui/material/Chip";
import { alpha } from "@mui/material/styles";
import React from "react";
import { SystemStatusIcon } from "./SystemStatusIcon";

export type SystemStatusChipProps = {
  status: SystemStatus;
  flavor: StatusFlavor;
  size: "small" | "medium";
};

export const SystemStatusChip = ({
  status,
  flavor,
  size,
}: SystemStatusChipProps) => {
  return (
    <Chip
      sx={{
        paddingLeft: 0.5,
        backgroundColor: alpha(statusColor(status), 0.16),
        color: statusTextColor(status),
      }}
      size={size}
      icon={<SystemStatusIcon status={status} flavor={flavor} size={size} />}
      label={statusTitle(status, flavor)}
    />
  );
};
