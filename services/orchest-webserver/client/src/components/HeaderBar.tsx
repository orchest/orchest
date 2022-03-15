import { useAppContext } from "@/contexts/AppContext";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useSessionsPoller } from "@/hooks/useSessionsPoller";
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
import { useLocation, useRouteMatch } from "react-router-dom";
import { IconButton } from "./common/IconButton";
import { ProjectSelector } from "./ProjectSelector";
import SessionToggleButton from "./SessionToggleButton";

export const HeaderBar = ({
  toggleDrawer,
  isDrawerOpen,
}: {
  toggleDrawer: () => void;
  isDrawerOpen: boolean;
}) => {
  const { navigateTo } = useCustomRoute();
  const location = useLocation();

  const {
    state: {
      projectUuid,
      pipelineUuid,
      pipelineName,
      pipelineSaveStatus,
      pipelineIsReadOnly,
    },
    dispatch,
  } = useProjectsContext();
  const appContext = useAppContext();
  useSessionsPoller();

  React.useEffect(() => {
    /*
      Always unset the pipeline for the header bar on navigation. 
      It's up to pages to request the headerbar pipeline if they 
      need it.
    */
    dispatch({
      type: "pipelineSet",
      payload: {
        pipelineUuid: undefined,
        pipelineName: undefined,
      },
    });
  }, [location]);

  const matchPipeline = useRouteMatch({
    path: siteMap.pipeline.path,
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
          onAuxClick={goToHome}
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
          {pipelineName && (
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="center"
              spacing={2}
            >
              {pipelineSaveStatus === "saved" ? (
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
                title={pipelineName}
                data-test-id="pipeline-name"
              >
                {pipelineName}
              </Typography>
            </Stack>
          )}
        </Box>
        <Stack spacing={2} direction="row">
          {pipelineName && !pipelineIsReadOnly && (
            <SessionToggleButton
              pipelineUuid={pipelineUuid}
              projectUuid={projectUuid}
            />
          )}
          {pipelineName && matchJupyter && (
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
          {pipelineName && !pipelineIsReadOnly && matchPipeline && (
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
            {appContext.state.user_config?.AUTH_ENABLED && (
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
