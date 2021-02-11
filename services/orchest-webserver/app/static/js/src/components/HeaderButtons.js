import React from "react";
import PipelineView from "../views/PipelineView";
import MDCButtonReact from "../lib/mdc-components/MDCButtonReact";
import { makeRequest } from "../lib/utils/all";

class HeaderButtons extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      pipeline_uuid: undefined,
      project_uuid: undefined,
      sessionActive: false,
      viewShowing: "pipeline",
    };
  }

  showPipeline() {
    this.updateCurrentView("pipeline");
    orchest.loadView(PipelineView, {
      pipeline_uuid: this.state.pipeline.uuid,
      project_uuid: this.state.project_uuid,
    });
  }

  showJupyter() {
    this.updateCurrentView("jupyter");
    orchest.showJupyter();
  }

  updateCurrentView(view) {
    this.setState({
      viewShowing: view,
    });
  }

  updateSessionState(active) {
    this.setState({
      sessionActive: active,
    });
  }

  clearPipeline() {
    this.setState({
      pipeline: undefined,
    });
  }

  setPipeline(pipelineJson, project_uuid, job_uuid) {
    this.setState({
      pipeline: pipelineJson,
      project_uuid: project_uuid,
    });
  }

  render() {
    if (this.state.pipeline) {
      return (
        <div>
          <span className="pipeline-name">{this.state.pipeline.name}</span>
          {this.state.viewShowing == "jupyter" && (
            <MDCButtonReact
              classNames={["mdc-button--raised"]}
              onClick={this.showPipeline.bind(this)}
              icon="device_hub"
              label="Switch to Pipeline"
            />
          )}

          {this.state.viewShowing == "pipeline" && this.state.sessionActive && (
            <MDCButtonReact
              classNames={["mdc-button--raised"]}
              onClick={this.showJupyter.bind(this)}
              icon="science"
              label="Switch to JupyterLab"
            />
          )}
        </div>
      );
    } else {
      return <div></div>;
    }
  }
}

export default HeaderButtons;
