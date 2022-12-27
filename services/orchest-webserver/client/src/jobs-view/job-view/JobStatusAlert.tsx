import { SystemStatusIcon } from "@/components/common/SystemStatusIcon";
import Alert, { AlertProps } from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useEditJob } from "../stores/useEditJob";
import { useJobActions } from "./hooks/useJobActions";

const alertMessageMapping: Record<
  "PAUSED" | "SUCCESS" | "ABORTED" | "FAILURE",
  { severity: AlertProps["severity"]; message: string }
> = {
  PAUSED: {
    severity: "warning",
    message: "Job paused",
  },
  ABORTED: {
    severity: "warning",
    message: "Job cancelled",
  },
  FAILURE: {
    severity: "error",
    message: "Job failed",
  },
  SUCCESS: {
    severity: "success",
    message: "All pipeline runs successful",
  },
};

export const JobStatusAlert = () => {
  const isEditing = useEditJob((state) => state.isEditing);
  const jobStatus = useEditJob((state) => state.jobChanges?.status);
  const { resumeJob } = useJobActions();

  const alert = isEditing ? undefined : alertMessageMapping[jobStatus || ""];
  return (
    <Collapse in={Boolean(alert)}>
      {hasValue(alert) && (
        <Alert
          severity={alert.severity}
          icon={<SystemStatusIcon flavor="job" status={jobStatus} />}
          action={
            jobStatus === "PAUSED" ? (
              <Button color="inherit" size="small" onClick={resumeJob}>
                RESUME
              </Button>
            ) : undefined
          }
        >
          {alert.message}
        </Alert>
      )}
    </Collapse>
  );
};
