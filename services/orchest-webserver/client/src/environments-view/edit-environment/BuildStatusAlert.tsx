import { EnvironmentImageBuild } from "@/types";
import Alert, { AlertProps } from "@mui/material/Alert";
import Collapse from "@mui/material/Collapse";
import { hasValue } from "@orchest/lib-utils";
import React from "react";

type BuildStatusAlertProps = {
  latestBuild?: EnvironmentImageBuild;
};

const alertMessageMapping: Record<
  "FAILURE" | "SUCCESS",
  { severity: AlertProps["severity"]; message: string }
> = {
  FAILURE: {
    severity: "error",
    message: "Build failed",
  },
  SUCCESS: {
    severity: "success",
    message: "Build successful",
  },
};

export const BuildStatusAlert = ({ latestBuild }: BuildStatusAlertProps) => {
  console.log("DEV latestBuild?.status: ", latestBuild?.status);
  const alert = alertMessageMapping[latestBuild?.status || ""];
  return (
    <Collapse in={Boolean(alert)}>
      {hasValue(alert) && (
        <Alert severity={alert.severity}>{alert.message}</Alert>
      )}
    </Collapse>
  );
};
