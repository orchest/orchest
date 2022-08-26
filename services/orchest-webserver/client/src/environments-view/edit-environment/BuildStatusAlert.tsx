import Alert, { AlertProps } from "@mui/material/Alert";
import Collapse from "@mui/material/Collapse";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { BuildStatusIcon } from "../BuildStatusIcon";
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
    severity: "error",
    message: "Build cancelled",
  },
  SUCCESS: {
    severity: "success",
    message: "Build successful",
  },
};

export const BuildStatusAlert = () => {
  const latestBuild = useEditEnvironment(
    (state) => state.environmentChanges?.latestBuild
  );
  const latestBuildStatus = latestBuild?.status;

  const alert = alertMessageMapping[latestBuildStatus || ""];
  return (
    <Collapse in={Boolean(alert)}>
      {hasValue(alert) && (
        <Alert
          severity={alert.severity}
          icon={<BuildStatusIcon latestBuild={latestBuild} />}
        >
          {alert.message}
        </Alert>
      )}
    </Collapse>
  );
};
