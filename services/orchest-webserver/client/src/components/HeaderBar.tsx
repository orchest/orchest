import React from "react";
import { useRouteMatch } from "react-router-dom";

import {
  MDCButtonReact,
  MDCCircularProgressReact,
  MDCIconButtonToggleReact,
} from "@orchest/lib-mdc";
import { useOrchest } from "@/hooks/orchest";
import ProjectSelector from "./ProjectSelector";
import SessionToggleButton from "./SessionToggleButton";

import { siteMap } from "@/Routes";
import { useMatchProjectRoot } from "@/hooks/useMatchProjectRoot";
import { useCustomRoute } from "@/hooks/useCustomRoute";

// HTMLHeaderElement doesn't exist, so we have to fall back to HTMLDivElement
export type THeaderBarRef = HTMLDivElement;

export const HeaderBar = (_, ref: React.MutableRefObject<null>) => {
  const { navigateTo } = useCustomRoute();

  const { state, dispatch, get } = useOrchest();

  const matchProjectRoot = useMatchProjectRoot();
  const matchPipeline = useRouteMatch({
    path: siteMap.pipeline.path,
    exact: true,
  });
  const matchJupyter = useRouteMatch({
    path: siteMap.jupyterLab.path,
    exact: true,
  });

  const goToHome = () => {
    navigateTo(siteMap.projects.path);
  };

  const showHelp = () => {
    navigateTo(siteMap.help.path);
  };

  const showPipeline = () => {
    navigateTo(siteMap.pipeline.path, {
      query: {
        projectUuid: state.projectUuid,
        pipelineUuid: state.pipelineUuid,
      },
    });
  };

  const showJupyter = () => {
    navigateTo(siteMap.jupyterLab.path, {
      query: {
        projectUuid: state.projectUuid,
        pipelineUuid: state.pipelineUuid,
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
        <img
          className="pointer logo"
          onClick={goToHome}
          src="/image/logo.svg"
          data-test-id="orchest-logo"
        />
        {!!matchProjectRoot && <ProjectSelector />}
      </div>

      {state.pipelineName && (
        <div className="pipeline-header-component">
          <div className="pipeline-name">
            <div className="pipelineStatusIndicator">
              {state.pipelineSaveStatus === "saved" ? (
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
            pipelineUuid={state.pipelineUuid}
            projectUuid={state.projectUuid}
          />
        )}

        {state.pipelineName && matchJupyter && (
          <MDCButtonReact
            classNames={["mdc-button--outlined"]}
            onClick={showPipeline}
            icon="device_hub"
            label="Switch to Pipeline"
          />
        )}

        {state.pipelineName && !state.pipelineIsReadOnly && matchPipeline && (
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
