import {
  StatusIcon,
  StatusIconStatus,
} from "@/components/Layout/layout-with-side-panel/StatusIcon";
import { JobStatus } from "@/types";
import React from "react";

type JobStatusIconProps = {
  status: JobStatus | undefined;
};

const getJobStatusIconStatus = (
  status: JobStatus | undefined
): StatusIconStatus | undefined => {
  if (status === "SUCCESS") return "SUCCESS";
  if (status === "PAUSED") return "PAUSED";
  if (status === "ABORTED" || status === "FAILURE") return "ERROR";
};

export const JobStatusIcon = ({ status }: JobStatusIconProps) => {
  const iconStatus = getJobStatusIconStatus(status);
  return iconStatus ? <StatusIcon status={iconStatus} /> : null;
};
