import React from "react";
import PipelineList from "../components/PipelineList";
import ProjectBasedView from "../components/ProjectBasedView";

class PipelinesView extends React.Component {
  render() {
    return (
      <ProjectBasedView
        project_uuid={this.props.project_uuid}
        childView={PipelineList}
      />
    );
  }
}

export default PipelinesView;
