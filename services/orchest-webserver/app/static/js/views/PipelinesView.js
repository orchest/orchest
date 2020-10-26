import React, { Fragment } from "react";
import PipelineList from "../components/PipelineList";
import ProjectSelector from "../components/ProjectSelector";

class PipelinesView extends React.Component {
  constructor(props) {
    super(props);

    this.state = {};

    if (props.project_uuid !== undefined) {
      this.state.project_uuid = props.project_uuid;
    }
  }

  onChangeProject(project_uuid) {
    this.setState({
      project_uuid: project_uuid,
    });

    if (project_uuid !== undefined) {
      this.setState({
        // TODO: make key unneccesary? --> PipelineLIst doesn't handle property swapping yet
        pipelineList: (
          <PipelineList key={project_uuid} project_uuid={project_uuid} />
        ),
      });
    }
  }

  render() {
    return (
      <div className="view-page">
        <div className="push-down">
          <ProjectSelector
            onChangeProject={this.onChangeProject.bind(this)}
            project_uuid={this.state.project_uuid}
          />
        </div>
        {(() => {
          if (this.state.project_uuid !== undefined) {
            return this.state.pipelineList;
          }
        })()}
      </div>
    );
  }
}

export default PipelinesView;
