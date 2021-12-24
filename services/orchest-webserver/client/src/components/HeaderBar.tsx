import { useAppContext } from "@/contexts/AppContext";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { isSession, useSessionsContext } from "@/contexts/SessionsContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/Routes";
import StyledButtonOutlined from "@/styled-components/StyledButton";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DeviceHubIcon from "@mui/icons-material/DeviceHub";
import HelpIcon from "@mui/icons-material/Help";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuIcon from "@mui/icons-material/Menu";
import ScienceIcon from "@mui/icons-material/Science";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import MuiIconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Toolbar from "@mui/material/Toolbar";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import React from "react";
import { useRouteMatch } from "react-router-dom";
import { IconButton } from "./common/IconButton";
import ProjectSelector from "./ProjectSelector";
import SessionToggleButton from "./SessionToggleButton";

export const HeaderBar = ({
  toggleDrawer,
  isDrawerOpen,
}: {
  toggleDrawer: () => void;
  isDrawerOpen: boolean;
}) => {
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
    <AppBar
      position="fixed"
      color="default"
      sx={{
        zIndex: (theme) => theme.zIndex.drawer + 1,
        backgroundColor: (theme) => theme.palette.background.paper,
        boxShadow: "none",
        borderBottom: (theme) => "1px solid " + theme.borderColor,
      }}
    >
      <Toolbar>
        <MuiIconButton
          title={`${isDrawerOpen ? "Collapse" : "Expand"} navigation`}
          onClick={(e) => {
            e.preventDefault();
            toggleDrawer();
          }}
          sx={{ marginLeft: (theme) => theme.spacing(-2) }}
        >
          <MenuIcon />
        </MuiIconButton>
        <Box
          component="img"
          onClick={goToHome}
          src="/image/logo.svg"
          data-test-id="orchest-logo"
          sx={{
            cursor: "pointer",
            width: (theme) => theme.spacing(5),
            margin: (theme) => theme.spacing(0, 2.5, 0, 1.25), // to align the AppDrawer ListIconText
          }}
        />
        <ProjectSelector />
        <LinearProgress />
        <Box sx={{ flex: 1 }}>
          {state.pipelineName && (
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="center"
              spacing={2}
            >
              {state.pipelineSaveStatus === "saved" ? (
                <Tooltip title="Pipeline saved">
                  <CheckCircleIcon />
                </Tooltip>
              ) : (
                <CircularProgress />
              )}
              <Typography
                variant="h6"
                sx={{
                  maxWidth: "50vw", // TODO: prevent using vw
                  textOverflow: "ellipsis",
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                }}
                title={state.pipelineName}
              >
                {state.pipelineName}
              </Typography>
            </Stack>
          )}
        </Box>
        <Stack spacing={2} direction="row">
          {state.pipelineName && !state.pipelineIsReadOnly && (
            <SessionToggleButton
              pipelineUuid={state.pipelineUuid}
              projectUuid={state.projectUuid}
            />
          )}
          {state.pipelineName && matchJupyter && (
            <StyledButtonOutlined
              variant="outlined"
              color="secondary"
              onClick={showPipeline}
              startIcon={<DeviceHubIcon />}
            >
              Switch to Pipeline
            </StyledButtonOutlined>
          )}
          {state.pipelineName && !state.pipelineIsReadOnly && matchPipeline && (
            <StyledButtonOutlined
              variant="outlined"
              color="secondary"
              onClick={showJupyter}
              startIcon={<ScienceIcon />}
              data-test-id="switch-to-jupyterlab"
            >
              Switch to JupyterLab
            </StyledButtonOutlined>
          )}
          {appContext.state.user_config?.AUTH_ENABLED && (
            <IconButton
              title="Logout"
              onClick={logoutHandler}
              color="secondary"
            >
              <LogoutIcon />
            </IconButton>
          )}
          <IconButton title="Help" onClick={showHelp} color="secondary">
            <HelpIcon />
          </IconButton>
        </Stack>
      </Toolbar>
    </AppBar>
  );
};

export default HeaderBar;
