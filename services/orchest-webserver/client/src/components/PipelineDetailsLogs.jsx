// @ts-check
// @TODO - Functional Component Transformation (then remove lines 1-2)
//         https://github.com/orchest/orchest/issues/259
import React from "react";
import LogViewer from "./LogViewer";

class PipelineDetailsLogs extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    return (
      <div className={"detail-subview"}>
        <LogViewer
          sio={this.props.sio}
          step_uuid={this.props.step.uuid}
          pipeline_uuid={this.props.pipeline.uuid}
          project_uuid={this.props.project_uuid}
          job_uuid={this.props.job_uuid}
          run_uuid={this.props.run_uuid}
        />
      </div>
    );
  }
}

export default PipelineDetailsLogs;
