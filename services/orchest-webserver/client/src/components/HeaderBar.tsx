import * as React from "react";
import {
  MDCButtonReact,
  MDCCircularProgressReact,
  MDCIconButtonToggleReact,
} from "@orchest/lib-mdc";
import { useOrchest } from "@/hooks/orchest";
import PipelineView from "../views/PipelineView";
import JupyterLabView from "../views/JupyterLabView";
import ProjectSelector from "./ProjectSelector";
import HelpView from "../views/HelpView";
import SessionToggleButton from "./SessionToggleButton";

// HTMLHeaderElement doesn't exist, so we have to fall back to HTMLDivElement
export type THeaderBarRef = HTMLDivElement;

export const HeaderBar = React.forwardRef<THeaderBarRef>((_, ref) => {
  const orchest = window.orchest;

  const { state, dispatch, get } = useOrchest();

  const isProjectSelectorVisible = [
    "jobs",
    "environments",
    "pipelines",
  ].includes(state?.view);

  const showPipeline = () => {
    dispatch({ type: "setView", payload: "pipeline" });

    orchest.loadView(PipelineView, {
      queryArgs: {
        pipeline_uuid: state.pipeline_uuid,
        project_uuid: state.project_uuid,
      },
    });
  };

  const showJupyter = () => {
    dispatch({ type: "setView", payload: "jupyter" });

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

  return (
    <header ref={ref} className="header-bar" data-test-id="header-bar">
      <div className="header-bar-left">
        <button
          data-test-id="header-bar-toggle"
          onClick={(e) => {
            e.preventDefault();
            dispatch({ type: "drawerToggle" });
          }}
          className="material-icons mdc-icon-button"
        >
          menu
        </button>
        <img src="/image/logo.svg" className="logo" />

        {isProjectSelectorVisible && (
          <ProjectSelector data-test-id="header-bar-project-selector" />
        )}
      </div>

      {state.pipelineName && (
        <div className="pipeline-header-component">
          <div className="pipeline-name">
            <div className="pipelineStatusIndicator">
              {state.pipelineSaveStatus == "saved" ? (
                <i
                  title="Pipeline saved"
                  className="material-icons"
                  data-test-id="header-bar-pipeline-saved"
                >
                  check_circle
                </i>
              ) : (
                <MDCCircularProgressReact data-test-id="header-bar-pipeline-saving" />
              )}
            </div>

            <span data-test-id="header-bar-pipeline-name">
              {state.pipelineName}
            </span>
          </div>
        </div>
      )}

      <div className="header-bar-actions">
        {state.pipelineName && !state.pipelineIsReadOnly && (
          <SessionToggleButton
            data-test-id="header-bar-session-toggle"
            pipeline_uuid={state.pipeline_uuid}
            project_uuid={state.project_uuid}
          />
        )}

        {state.pipelineName && state.view == "jupyter" && (
          <MDCButtonReact
            data-test-id="header-bar-switch-to-pipeline"
            classNames={["mdc-button--outlined"]}
            onClick={showPipeline.bind(this)}
            icon="device_hub"
            label="Switch to Pipeline"
          />
        )}

        {state.pipelineName &&
          !state.pipelineIsReadOnly &&
          state.view == "pipeline" && (
            <MDCButtonReact
              data-test-id="header-bar-switch-to-jupyter"
              disabled={get.currentSession?.status !== "RUNNING"}
              classNames={["mdc-button--outlined"]}
              onClick={showJupyter.bind(this)}
              icon="science"
              label="Switch to JupyterLab"
            />
          )}

        {state?.user_config.AUTH_ENABLED && (
          <MDCIconButtonToggleReact
            data-test-id="header-bar-logout"
            icon="logout"
            tooltipText="Logout"
            onClick={logoutHandler.bind(this)}
          />
        )}

        <MDCIconButtonToggleReact
          data-test-id="header-bar-help"
          icon="help"
          tooltipText="Help"
          onClick={orchest.loadView.bind(orchest, HelpView)}
        />
      </div>
    </header>
  );
});

export default HeaderBar;
