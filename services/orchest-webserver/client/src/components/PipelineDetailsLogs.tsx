// @ts-check
import React from "react";
import LogViewer from "./LogViewer";

/**
 * @typedef {import("./LogViewer").TLogViewProps} TPipelineDetailsLogs
 *
 * @type React.FC<TPipelineDetailsLogs>
 */
const PipelineDetailsLogs = (props) => (
  <div className={"detail-subview"}>
    <LogViewer {...props} />
  </div>
);

export default PipelineDetailsLogs;
