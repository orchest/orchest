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
    <header className="header-bar" ref={ref}>
      <div className="header-bar-left">
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

        {isProjectSelectorVisible && <ProjectSelector />}
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

      <div className="header-bar-actions">
        {state.pipelineName && !state.pipelineIsReadOnly && (
          <SessionToggleButton
            pipeline_uuid={state.pipeline_uuid}
            project_uuid={state.project_uuid}
          />
        )}

        {state.pipelineName && state.view == "jupyter" && (
          <MDCButtonReact
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
          icon="help"
          tooltipText="Help"
          onClick={orchest.loadView.bind(orchest, HelpView)}
        />
      </div>
    </header>
  );
});

export default HeaderBar;
