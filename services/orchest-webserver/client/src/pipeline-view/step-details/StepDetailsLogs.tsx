import Stack from "@mui/material/Stack";
import React from "react";
import { LogViewer, LogViewerProps } from "../LogViewer";
import { useStepDetailsContext } from "./StepDetailsContext";

export const StepDetailsLogs = (props: Omit<LogViewerProps, "logId">) => {
  const { step } = useStepDetailsContext();

  return (
    <Stack height="100%">
      <LogViewer {...props} logId={step.uuid} />
    </Stack>
  );
};
