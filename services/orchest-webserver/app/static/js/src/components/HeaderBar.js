import React from "react";
import PipelineView from "../views/PipelineView";
import MDCButtonReact from "../lib/mdc-components/MDCButtonReact";
import JupyterLabView from "../views/JupyterLabView";
import MDCCircularProgressReact from "../lib/mdc-components/MDCCircularProgressReact";
import MDCIconButtonToggleReact from "../lib/mdc-components/MDCIconButtonToggleReact";
import ProjectSelector from "./ProjectSelector";
import SettingsView from "../views/SettingsView";
import HelpView from "../views/HelpView";

class HeaderBar extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      pipeline_uuid: undefined,
      project_uuid: undefined,
      sessionActive: false,
      viewShowing: "pipeline",
      pipelineSaveStatus: "saved",
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

  pipelineSaveStatus(status) {
    this.setState({
      pipelineSaveStatus: status,
    });
  }

  logoutHandler() {
    window.location.href = "/login/clear";
  }

  handleMenuButton() {
    this.props.toggleDrawer();
  }

  onChangeProject(projectUUID) {
    this.props.changeSelectedProject(projectUUID);
  }

  render() {
    return (
      <header>
        <div className="header-left">
          <button
            onClick={this.handleMenuButton.bind(this)}
            className="material-icons mdc-icon-button"
          >
            menu
          </button>
          <img src="public/image/favicon.png" className="logo" />
          <ProjectSelector
            key={this.props.projectSelectorHash}
            onChangeProject={this.onChangeProject.bind(this)}
            project_uuid={this.props.selectedProject}
          />
        </div>

        {this.state.pipelineName && (
          <div className="pipeline-header-component">
            <div className="pipeline-name">
              <div className="pipelineStatusIndicator">
                {this.state.pipelineSaveStatus == "saved" ? (
                  <i title="Pipeline saved" className="material-icons">
                    check_circle
                  </i>
                ) : (
                  <MDCCircularProgressReact />
                )}
              </div>

              {this.state.pipelineName}
            </div>
          </div>
        )}

        <div className="global-actions">
          {this.state.pipelineName && this.state.viewShowing == "jupyter" && (
            <MDCButtonReact
              classNames={["mdc-button--outlined"]}
              onClick={this.showPipeline.bind(this)}
              icon="device_hub"
              label="Switch to Pipeline"
            />
          )}

          {this.state.pipelineName && this.state.viewShowing == "pipeline" && (
            <MDCButtonReact
              classNames={["mdc-button--outlined"]}
              onClick={this.showJupyter.bind(this)}
              icon="science"
              label="Switch to JupyterLab"
            />
          )}

          {orchest.user_config.AUTH_ENABLED && (
            <MDCIconButtonToggleReact
              icon="logout"
              tooltipText="Logout"
              onClick={this.logoutHandler.bind(this)}
            />
          )}
          <MDCIconButtonToggleReact
            icon="settings"
            tooltipText="Settings"
            onClick={orchest.loadView.bind(orchest, SettingsView)}
          />
          <MDCIconButtonToggleReact
            icon="help"
            tooltipText="Help"
            onClick={orchest.loadView.bind(orchest, HelpView)}
          />
        </div>
      </header>
    );
  }
}

export default HeaderBar;
