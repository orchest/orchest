import React from "react";
import { ILogViewerProps, LogViewer } from "../LogViewer";
import { useStepDetailsContext } from "./StepDetailsContext";

export const StepDetailsLogs = (props: Omit<ILogViewerProps, "logId">) => {
  const { step } = useStepDetailsContext();
  return (
    <div className={"detail-subview"}>
      <LogViewer {...props} logId={step.uuid} />
    </div>
  );
};
