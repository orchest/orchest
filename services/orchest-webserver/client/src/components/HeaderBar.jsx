import React from "react";
import { RefManager, uuidv4 } from "@orchest/lib-utils";
import {
  MDCButtonReact,
  MDCCircularProgressReact,
  MDCIconButtonToggleReact,
} from "@orchest/lib-mdc";
import { OrchestContext } from "@/lib/orchest";
import PipelineView from "../views/PipelineView";
import JupyterLabView from "../views/JupyterLabView";
import ProjectSelector from "./ProjectSelector";
import SettingsView from "../views/SettingsView";
import HelpView from "../views/HelpView";
import SessionToggleButton from "./SessionToggleButton";

class HeaderBar extends React.Component {
  static contextType = OrchestContext;

  constructor(props, context) {
    super(props, context);

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

  showPipeline() {
    this.context.dispatch({ type: "viewUpdateCurrent", payload: "pipeline" });

    orchest.loadView(PipelineView, {
      queryArgs: {
        pipeline_uuid: this.context.state.pipeline_uuid,
        project_uuid: this.context.state.project_uuid,
      },
    });
  }

  showJupyter() {
    this.context.dispatch({ type: "viewUpdateCurrent", payload: "jupyter" });

    orchest.loadView(JupyterLabView, {
      queryArgs: {
        pipeline_uuid: this.context.state.pipeline_uuid,
        project_uuid: this.context.state.project_uuid,
      },
    });
  }

  logoutHandler() {
    window.location.href = "/login/clear";
  }

  onChangeProject(projectUUID) {
    this.props.changeSelectedProject(projectUUID);
  }

  onSessionStateChange(working, running, session_details) {
    this.setState({
      sessionActive: running,
    });

    if (this.context.state.onSessionStateChange) {
      this.context.state.onSessionStateChange(
        working,
        running,
        session_details
      );
    }
  }

  onSessionFetch(session_details) {
    if (this.context.state.onSessionFetch) {
      this.context.state.onSessionFetch(session_details);
    }
  }

  onSessionShutdown() {
    if (this.context.state.onSessionShutdown) {
      this.context.state.onSessionShutdown();
    }
  }

  render() {
    return (
      <header>
        <div className="header-left">
          <button
            onClick={(e) => {
              e.preventDefault();
              this.context.dispatch({ type: "drawerToggle" });
            }}
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

        {this.context.state.pipelineName && (
          <div className="pipeline-header-component">
            <div className="pipeline-name">
              <div className="pipelineStatusIndicator">
                {this.context.state.pipelineSaveStatus == "saved" ? (
                  <i title="Pipeline saved" className="material-icons">
                    check_circle
                  </i>
                ) : (
                  <MDCCircularProgressReact />
                )}
              </div>

              {this.context.state.pipelineName}
            </div>
          </div>
        )}

        <div className="header-actions">
          {this.context.state.pipelineName &&
            !this.context.state.pipelineIsReadOnly && (
              <SessionToggleButton
                ref={this.refManager.nrefs.sessionToggleButton}
              />
            )}

          {this.context.state.pipelineName &&
            this.context.state.viewCurrent == "jupyter" && (
              <MDCButtonReact
                classNames={["mdc-button--outlined"]}
                onClick={this.showPipeline.bind(this)}
                icon="device_hub"
                label="Switch to Pipeline"
              />
            )}

          {this.context.state.pipelineName &&
            !this.context.state.pipelineIsReadOnly &&
            this.context.state.viewCurrent == "pipeline" && (
              <MDCButtonReact
                disabled={!this.context.state.sessionActive}
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
