import { useAppContext } from "@/contexts/AppContext";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { isSession, useSessionsContext } from "@/contexts/SessionsContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/Routes";
import DeviceHubIcon from "@mui/icons-material/DeviceHub";
import HelpIcon from "@mui/icons-material/Help";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuIcon from "@mui/icons-material/Menu";
import ScienceIcon from "@mui/icons-material/Science";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import React from "react";
import { useRouteMatch } from "react-router-dom";
import ProjectSelector from "./ProjectSelector";
import SessionToggleButton from "./SessionToggleButton";

// HTMLHeaderElement doesn't exist, so we have to fall back to HTMLDivElement
export type THeaderBarRef = HTMLDivElement;

export const HeaderBar = (
  { toggleDrawer }: { toggleDrawer: () => void },
  ref: React.MutableRefObject<null>
) => {
  const { navigateTo } = useCustomRoute();
  const { state } = useProjectsContext();
  const appContext = useAppContext();
  const {
    state: { sessions },
  } = useSessionsContext();
  const currentSession = sessions.find((session) => isSession(session, state));

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
        <IconButton
          onClick={(e) => {
            e.preventDefault();
            toggleDrawer();
          }}
        >
          <MenuIcon />
        </IconButton>
        <img
          className="pointer logo"
          onClick={goToHome}
          src="/image/logo.svg"
          data-test-id="orchest-logo"
        />
        <ProjectSelector />
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
                <CircularProgress />
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
          <Button
            variant="outlined"
            color="secondary"
            onClick={showPipeline}
            startIcon={<DeviceHubIcon />}
          >
            Switch to Pipeline
          </Button>
        )}
        {state.pipelineName && !state.pipelineIsReadOnly && matchPipeline && (
          <Button
            variant="outlined"
            color="secondary"
            disabled={currentSession?.status !== "RUNNING"}
            onClick={showJupyter}
            startIcon={<ScienceIcon />}
            data-test-id="switch-to-jupyterlab"
          >
            Switch to JupyterLab
          </Button>
        )}
        {appContext.state.user_config?.AUTH_ENABLED && (
          <Tooltip title="Logout">
            <IconButton onClick={logoutHandler} color="secondary">
              <LogoutIcon />
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title="Help">
          <IconButton onClick={showHelp} color="secondary">
            <HelpIcon />
          </IconButton>
        </Tooltip>
      </div>
    </header>
  );
};

export default React.forwardRef(HeaderBar);
