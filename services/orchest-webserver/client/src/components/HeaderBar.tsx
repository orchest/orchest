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
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useRouteMatch } from "react-router-dom";
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
  const { navigateTo, pipelineUuid } = useCustomRoute();

  const {
    state: { projectUuid, pipeline, pipelineSaveStatus, pipelineIsReadOnly },
  } = useProjectsContext();
  const appContext = useAppContext();
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

  // Only show the pipeline name if pipeline_uuid is in the route args,
  // where `pipeline` exists in `PorjectsContext` or not.
  const isShowingPipelineName = hasValue(pipelineUuid && pipeline);

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
          {isShowingPipelineName && (
            <Stack
              direction="column"
              alignItems="center"
              justifyContent="center"
            >
              <Stack direction="row" alignItems="center">
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
                    maxWidth: "45vw", // TODO: prevent using vw
                    textOverflow: "ellipsis",
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    margin: (theme) => theme.spacing(0, 1),
                  }}
                  title={pipeline.name}
                  data-test-id="pipeline-name"
                >
                  {pipeline.name}
                </Typography>
              </Stack>
              <Typography
                variant="caption"
                sx={{
                  maxWidth: "45vw", // TODO: prevent using vw
                  textOverflow: "ellipsis",
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                  color: (theme) => theme.palette.grey[700],
                }}
                title={pipeline.path}
                data-test-id="pipeline-path"
              >
                {pipeline.path}
              </Typography>
            </Stack>
          )}
        </Box>
        <Stack spacing={2} direction="row">
          {!matchFilePreview && pipeline && !pipelineIsReadOnly && (
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
