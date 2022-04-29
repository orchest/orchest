import React from "react";
import { ILogViewerProps, LogViewer } from "../LogViewer";

export const StepDetailsLogs = (props: ILogViewerProps) => (
  <div className={"detail-subview"}>
    <LogViewer {...props} />
  </div>
);
