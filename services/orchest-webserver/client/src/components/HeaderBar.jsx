// @ts-check
import React from "react";
import {
  MDCButtonReact,
  MDCCircularProgressReact,
  MDCIconButtonToggleReact,
} from "@orchest/lib-mdc";
import { useOrchest } from "@/lib/orchest";
import PipelineView from "../views/PipelineView";
import JupyterLabView from "../views/JupyterLabView";
import ProjectSelector from "./ProjectSelector";
import SettingsView from "../views/SettingsView";
import HelpView from "../views/HelpView";
import SessionToggleButton from "./SessionToggleButton";

/**
 * @typedef {import("@/types").IOrchestSession} IOrchestSession
 *
 * @TODO Remove props and handle project switching inside useOrchest
 * @typedef {Object} HeaderBarProps
 * @property {(projectUUID) => void} changeSelectedProject
 * @property {string} projectSelectorHash
 * @property {string} selectedProject
 */

/**
 * @type {React.FC<HeaderBarProps>}
 */
export const HeaderBar = React.forwardRef((props, ref) => {
  const orchest = window.orchest;

  const { state, dispatch, get } = useOrchest();

  const showPipeline = () => {
    dispatch({ type: "viewUpdateCurrent", payload: "pipeline" });

    orchest.loadView(PipelineView, {
      queryArgs: {
        pipeline_uuid: state.pipeline_uuid,
        project_uuid: state.project_uuid,
      },
    });
  };

  const showJupyter = () => {
    dispatch({ type: "viewUpdateCurrent", payload: "jupyter" });

    orchest.loadView(JupyterLabView, {
      queryArgs: {
        pipeline_uuid: state.pipeline_uuid,
        project_uuid: state.project_uuid,
      },
    });
  };

  const logoutHandler = () => {
    window.location.href = "/login/clear";
  };

  const onChangeProject = (projectUUID) => {
    props.changeSelectedProject(projectUUID);
  };

  return (
    <header ref={ref}>
      <div className="header-left">
        <button
          onClick={(e) => {
            e.preventDefault();
            dispatch({ type: "drawerToggle" });
          }}
          className="material-icons mdc-icon-button"
        >
          menu
        </button>
        <img src="/image/logo.svg" className="logo" />
        <ProjectSelector
          key={props.projectSelectorHash}
          onChangeProject={onChangeProject.bind(this)}
          project_uuid={props.selectedProject}
        />
      </div>

      {state.pipelineName && (
        <div className="pipeline-header-component">
          <div className="pipeline-name">
            <div className="pipelineStatusIndicator">
              {state.pipelineSaveStatus == "saved" ? (
                <i title="Pipeline saved" className="material-icons">
                  check_circle
                </i>
              ) : (
                <MDCCircularProgressReact />
              )}
            </div>

            {state.pipelineName}
          </div>
        </div>
      )}

      <div className="header-actions">
        {state.pipelineName && !state.pipelineIsReadOnly && (
          <SessionToggleButton
            pipeline_uuid={state.pipeline_uuid}
            project_uuid={state.project_uuid}
          />
        )}

        {state.pipelineName && state.viewCurrent == "jupyter" && (
          <MDCButtonReact
            classNames={["mdc-button--outlined"]}
            onClick={showPipeline.bind(this)}
            icon="device_hub"
            label="Switch to Pipeline"
          />
        )}

        {state.pipelineName &&
          !state.pipelineIsReadOnly &&
          state.viewCurrent == "pipeline" && (
            <MDCButtonReact
              disabled={get.currentSession?.status !== "RUNNING"}
              classNames={["mdc-button--outlined"]}
              onClick={showJupyter.bind(this)}
              icon="science"
              label="Switch to JupyterLab"
            />
          )}

        {state?.user_config.AUTH_ENABLED && (
          <MDCIconButtonToggleReact
            icon="logout"
            tooltipText="Logout"
            onClick={logoutHandler.bind(this)}
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
});

export default HeaderBar;
