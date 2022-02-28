import React from "react";
import LogViewer, { ILogViewerProps } from "../LogViewer";

export const StepDetailsLogs: React.FC<ILogViewerProps> = (props) => (
  <div className={"detail-subview"}>
    <LogViewer {...props} />
  </div>
);
