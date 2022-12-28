import { SystemStatusIcon } from "@/components/common/SystemStatusIcon";
import Alert, { AlertProps } from "@mui/material/Alert";
import Collapse from "@mui/material/Collapse";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useEditEnvironment } from "../stores/useEditEnvironment";

const alertMessageMapping: Record<
  "FAILURE" | "SUCCESS" | "ABORTED",
  { severity: AlertProps["severity"]; message: string }
> = {
  FAILURE: {
    severity: "error",
    message: "Build failed",
  },
  ABORTED: {
    severity: "warning",
    message: "Build cancelled",
  },
  SUCCESS: {
    severity: "success",
    message: "Build successful",
  },
};

export const BuildStatusAlert = () => {
  const latestBuildStatus = useEditEnvironment(
    (state) => state.changes?.latestBuild?.status
  );

  const alert = alertMessageMapping[latestBuildStatus || ""];

  return (
    <Collapse in={Boolean(alert)}>
      {hasValue(alert) && (
        <Alert
          severity={alert.severity}
          icon={
            <SystemStatusIcon
              status={latestBuildStatus}
              flavor="build"
              size="small"
            />
          }
        >
          {alert.message}
        </Alert>
      )}
    </Collapse>
  );
};
