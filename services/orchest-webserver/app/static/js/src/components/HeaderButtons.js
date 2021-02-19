import React from "react";
import PipelineView from "../views/PipelineView";
import MDCButtonReact from "../lib/mdc-components/MDCButtonReact";
import JupyterLabView from "../views/JupyterLabView";

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
      queryArgs: {
        pipeline_uuid: this.state.pipeline_uuid,
        project_uuid: this.state.project_uuid,
      },
    });
  }

  showJupyter() {
    this.updateCurrentView("jupyter");
    orchest.loadView(JupyterLabView, {
      queryArgs: {
        pipeline_uuid: this.state.pipeline_uuid,
        project_uuid: this.state.project_uuid,
      },
    });
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
      pipeline_uuid: undefined,
      project_uuid: undefined,
      pipelineName: undefined,
    });
  }

  setPipeline(pipeline_uuid, project_uuid, pipelineName) {
    this.setState({
      pipeline_uuid: pipeline_uuid,
      project_uuid: project_uuid,
      pipelineName: pipelineName,
    });
  }

  render() {
    if (this.state.pipelineName) {
      return (
        <div>
          <span className="pipeline-name">{this.state.pipelineName}</span>
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
