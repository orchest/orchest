import * as React from "react";
import LogViewer, { ILogViewerProps } from "./LogViewer";

export interface IPipelineDetailsLogsProps extends ILogViewerProps {}

const PipelineDetailsLogs: React.FC<IPipelineDetailsLogsProps> = (props) => (
  <div className={"detail-subview"}>
    <LogViewer {...props} />
  </div>
);

export default PipelineDetailsLogs;
