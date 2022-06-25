import { useAppContext } from "@/contexts/AppContext";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useSessionsPoller } from "@/hooks/useSessionsPoller";
import { siteMap } from "@/routingConfig";
import StyledButtonOutlined from "@/styled-components/StyledButton";
import DeviceHubIcon from "@mui/icons-material/DeviceHub";
import HelpIcon from "@mui/icons-material/Help";
import LogoutIcon from "@mui/icons-material/Logout";
import ScienceIcon from "@mui/icons-material/Science";
import AppBar from "@mui/material/AppBar";
import Stack from "@mui/material/Stack";
import Toolbar from "@mui/material/Toolbar";
import React from "react";
import { useRouteMatch } from "react-router-dom";
import { IconButton } from "../components/common/IconButton";
import SessionToggleButton from "../components/SessionToggleButton";
import { ProjectSelector } from "../project-selector/ProjectSelector";
import { NavigationTabs } from "./NavigationTabs";

export const HeaderBar = ({
  toggleDrawer,
  isDrawerOpen,
}: {
  toggleDrawer: () => void;
  isDrawerOpen: boolean;
}) => {
  const { navigateTo, pipelineUuid } = useCustomRoute();
  const {
    state: { projectUuid, pipeline, pipelineIsReadOnly },
  } = useProjectsContext();
  const { user_config } = useAppContext();
  useSessionsPoller();

  const matchPipeline = useRouteMatch({
    path: siteMap.pipeline.path,
    exact: true,
  });

  const matchFilePreview = useRouteMatch({
    path: siteMap.filePreview.path,
    exact: true,
  });

  const matchJupyter = useRouteMatch({
    path: siteMap.jupyterLab.path,
    exact: true,
  });

  const goToHome = (e: React.MouseEvent) => {
    navigateTo(siteMap.projects.path, undefined, e);
  };

  const showHelp = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    navigateTo(siteMap.help.path, undefined, e);
  };

  const showPipeline = (e: React.MouseEvent) => {
    navigateTo(
      siteMap.pipeline.path,
      { query: { projectUuid, pipelineUuid } },
      e
    );
  };

  const showJupyter = (e: React.MouseEvent) => {
    navigateTo(
      siteMap.jupyterLab.path,
      { query: { projectUuid, pipelineUuid } },
      e
    );
  };

  const logoutHandler = () => {
    window.location.href = "/login/clear";
  };

  return (
    <AppBar
      position="fixed"
      color="default"
      sx={{
        zIndex: (theme) => theme.zIndex.drawer + 1,
        backgroundColor: (theme) => theme.palette.background.paper,
        boxShadow: "none",
        borderBottom: (theme) => `1px solid ${theme.borderColor}`,
      }}
    >
      <Toolbar
        variant="dense"
        sx={{ justifyContent: "space-between", paddingLeft: "0 !important" }}
      >
        <ProjectSelector />
        <Stack spacing={2} direction="row" justifyContent="flex-end">
          <NavigationTabs />
          {!matchFilePreview &&
            pipeline &&
            !pipelineIsReadOnly &&
            projectUuid &&
            pipelineUuid && (
              <SessionToggleButton
                pipelineUuid={pipelineUuid}
                projectUuid={projectUuid}
              />
            )}
          {pipeline && matchJupyter && (
            <StyledButtonOutlined
              variant="outlined"
              color="secondary"
              onClick={showPipeline}
              onAuxClick={showPipeline}
              startIcon={<DeviceHubIcon />}
            >
              Switch to Pipeline
            </StyledButtonOutlined>
          )}
          {pipeline && !pipelineIsReadOnly && matchPipeline && (
            <StyledButtonOutlined
              variant="outlined"
              color="secondary"
              onClick={showJupyter}
              onAuxClick={showJupyter}
              startIcon={<ScienceIcon />}
              data-test-id="switch-to-jupyterlab"
            >
              Switch to JupyterLab
            </StyledButtonOutlined>
          )}
          <Stack
            spacing={1}
            direction="row"
            sx={{ paddingLeft: (theme) => theme.spacing(1) }}
          >
            {user_config?.AUTH_ENABLED && (
              <IconButton
                title="Logout"
                onClick={logoutHandler}
                color="secondary"
              >
                <LogoutIcon />
              </IconButton>
            )}
            <IconButton
              title="Help"
              onClick={showHelp}
              onAuxClick={showHelp}
              color="secondary"
            >
              <HelpIcon />
            </IconButton>
          </Stack>
        </Stack>
      </Toolbar>
    </AppBar>
  );
};

export default HeaderBar;
