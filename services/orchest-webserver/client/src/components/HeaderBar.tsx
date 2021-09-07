import * as React from "react";
import { useHistory } from "react-router-dom";

import {
  MDCButtonReact,
  MDCCircularProgressReact,
  MDCIconButtonToggleReact,
} from "@orchest/lib-mdc";
import { useOrchest } from "@/hooks/orchest";
import ProjectSelector from "./ProjectSelector";
import SessionToggleButton from "./SessionToggleButton";

import { siteMap, generatePathFromRoute } from "@/Routes";

// HTMLHeaderElement doesn't exist, so we have to fall back to HTMLDivElement
export type THeaderBarRef = HTMLDivElement;

export const HeaderBar = (_, ref: React.MutableRefObject<null>) => {
  const history = useHistory();
  const { state, dispatch, get } = useOrchest();

  const isProjectSelectorVisible = [
    "jobs",
    "environments",
    "pipelines",
  ].includes(state?.view);

  const goToHome = () => {
    history.push(siteMap.projects.path);
  };

  const showHelp = () => {
    history.push(siteMap.help.path);
  };

  const showPipeline = () => {
    dispatch({ type: "setView", payload: "pipeline" });
    history.push(
      generatePathFromRoute(siteMap.pipeline.path, {
        projectId: state.project_uuid,
        pipelineId: state.pipeline_uuid,
      })
    );
  };

  const showJupyter = () => {
    dispatch({ type: "setView", payload: "jupyter" });

    history.push(
      generatePathFromRoute(siteMap.jupyterLab.path, {
        projectId: state.project_uuid,
        pipelineId: state.pipeline_uuid,
      })
    );
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
        <img
          className="pointer logo"
          onClick={goToHome}
          src="/image/logo.svg"
          data-test-id="orchest-logo"
        />
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
            onClick={showPipeline}
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
              onClick={showJupyter}
              icon="science"
              label="Switch to JupyterLab"
              data-test-id="switch-to-jupyterlab"
            />
          )}

        {state?.user_config.AUTH_ENABLED && (
          <MDCIconButtonToggleReact
            icon="logout"
            tooltipText="Logout"
            onClick={logoutHandler}
          />
        )}

        <MDCIconButtonToggleReact
          icon="help"
          tooltipText="Help"
          onClick={showHelp}
        />
      </div>
    </header>
  );
};

export default React.forwardRef(HeaderBar);
