import React from "react";
import { RefManager, uuidv4 } from "@orchest/lib-utils";
import { OrchestContext } from "@/lib/orchest";
import {
  MDCButtonReact,
  MDCCircularProgressReact,
  MDCIconButtonToggleReact,
} from "@orchest/lib-mdc";
import PipelineView from "../views/PipelineView";
import JupyterLabView from "../views/JupyterLabView";
import ProjectSelector from "./ProjectSelector";
import SettingsView from "../views/SettingsView";
import HelpView from "../views/HelpView";
import SessionToggleButton from "./SessionToggleButton";

class HeaderBar extends React.Component {
  static contextType = OrchestContext;

  constructor(props) {
    super(props);

    this.state = {
      pipeline_uuid: undefined,
      project_uuid: undefined,
      sessionActive: false,
      readOnlyPipeline: false,
      viewShowing: "pipeline",
      pipelineSaveStatus: "saved",
      onSessionStateChange: undefined,
      onSessionShutdown: undefined,
      onSessionFetch: undefined,
    };

    this.refManager = new RefManager();
  }

  showJupyter() {
    this.context.updateCurrentView("jupyter");
    this.context.loadView(JupyterLabView, {
      queryArgs: {
        pipeline_uuid: this.context.pipeline.pipeline_uuid,
        project_uuid: this.context.pipeline.project_uuid,
      },
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

  toggleSession() {
    if (this.refManager.refs.sessionToggleButton) {
      this.refManager.refs.sessionToggleButton.toggleSession();
    }
  }

  fetchSessionStatus() {
    // Make sure all renders have been flushed,
    // such that SessionToggleButton is available.
    if (this.refManager.refs.sessionToggleButton) {
      this.refManager.refs.sessionToggleButton.fetchSessionStatus();
    }
  }

  onSessionStateChange(working, running, session_details) {
    this.setState({
      sessionActive: running,
    });

    if (this.context.pipeline.onSessionStateChange) {
      this.context.setPipelineState((prevState) => ({
        ...prevState,
        sessionActive: running,
      }));

      this.context.pipeline.onSessionStateChange(
        working,
        running,
        session_details
      );
    }
  }

  onSessionFetch(session_details) {
    if (this.context.pipeline.onSessionFetch) {
      this.context.pipeline.onSessionFetch(session_details);
    }
  }

  onSessionShutdown() {
    if (this.context.pipeline.onSessionShutdown) {
      this.context.pipeline.onSessionShutdown();
    }
  }

  componentDidUpdate(_, prevState) {
    if (
      this.context.pipeline.pipelineFetchHash !=
      this.context.pipeline.pipelineFetchHash
    ) {
      this.fetchSessionStatus();
    }
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
          <img src="/image/logo.svg" className="logo" />
          <ProjectSelector
            key={this.props.projectSelectorHash}
            onChangeProject={this.onChangeProject.bind(this)}
            project_uuid={this.props.selectedProject}
          />
        </div>

        {this.context.pipeline.pipelineName && (
          <div className="pipeline-header-component">
            <div className="pipeline-name">
              <div className="pipelineStatusIndicator">
                {this.context.pipeline.pipelineSaveStatus == "saved" ? (
                  <i title="Pipeline saved" className="material-icons">
                    check_circle
                  </i>
                ) : (
                  <MDCCircularProgressReact />
                )}
              </div>

              {this.context.pipeline.pipelineName}
            </div>
          </div>
        )}

        <div className="header-actions">
          {this.context.pipeline.pipelineName &&
            !this.context.pipeline.readOnlyPipeline && (
              <SessionToggleButton
                ref={this.refManager.nrefs.sessionToggleButton}
                pipeline_uuid={this.context.pipeline.pipeline_uuid}
                project_uuid={this.context.pipeline.project_uuid}
                onSessionStateChange={this.onSessionStateChange.bind(this)}
                onSessionFetch={this.onSessionFetch.bind(this)}
                onSessionShutdown={this.onSessionShutdown.bind(this)}
              />
            )}

          {this.context.pipeline.pipelineName &&
            this.context.pipeline.viewShowing == "jupyter" && (
              <MDCButtonReact
                classNames={["mdc-button--outlined"]}
                onClick={this.context.showPipeline.bind(this)}
                icon="device_hub"
                label="Switch to Pipeline"
              />
            )}

          {this.context.pipeline.pipelineName &&
            !this.context.pipeline.readOnlyPipeline &&
            this.context.pipeline.viewShowing == "pipeline" && (
              <MDCButtonReact
                disabled={!this.context.pipeline.sessionActive}
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
