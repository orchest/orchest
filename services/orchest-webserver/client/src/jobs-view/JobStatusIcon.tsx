import {
  StatusIcon,
  statusIconDefaultProps,
  StatusIconStatus,
} from "@/components/Layout/layout-with-side-panel/StatusIcon";
import { JobStatus } from "@/types";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import React from "react";

type JobStatusIconProps = {
  status: JobStatus;
};

const jobStatusIconStatusMapping: Omit<
  Record<JobStatus, StatusIconStatus>,
  "PENDING"
> = {
  ABORTED: "ERROR",
  FAILURE: "ERROR",
  DRAFT: "DRAFT",
  SUCCESS: "SUCCESS",
  PAUSED: "PAUSED",
  STARTED: "IN_PROGRESS",
};

export const JobStatusIcon = ({ status }: JobStatusIconProps) => {
  return status === "PENDING" ? (
    <ScheduleOutlinedIcon {...statusIconDefaultProps} />
  ) : (
    <StatusIcon status={jobStatusIconStatusMapping[status]} />
  );
};
