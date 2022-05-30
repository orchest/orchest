import { useAppContext } from "@/contexts/AppContext";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useSessionsPoller } from "@/hooks/useSessionsPoller";
import { cleanFilePath } from "@/pipeline-view/file-manager/common";
import { siteMap } from "@/routingConfig";
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
import Stack from "@mui/material/Stack";
import Toolbar from "@mui/material/Toolbar";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useRouteMatch } from "react-router-dom";
import { ProjectSelector } from "../project-selector/ProjectSelector";
import { IconButton } from "./common/IconButton";
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
  // Only show the pipeline name if pipeline_uuid is in the route args,
  // where `pipeline` exists in `PorjectsContext` or not.
  const isShowingPipelineName = hasValue(pipelineUuid) && hasValue(pipeline);

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
        sx={{
          justifyContent: "space-between",
        }}
      >
        <Stack direction="row" alignItems="center">
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
        </Stack>
        <Stack
          direction="column"
          alignItems="center"
          justifyContent="center"
          sx={{
            flex: 1,
            maxWidth: "33%",
            left: {
              xl: "50%",
            },
            position: {
              xl: "absolute",
            },
            transform: {
              xl: "translateX(-50%)",
            },
          }}
        >
          {isShowingPipelineName && (
            <>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="center"
                sx={{ width: "100%" }}
              >
                {pipelineSaveStatus === "saved" ? (
                  <Tooltip title="Pipeline saved">
                    <CheckCircleIcon />
                  </Tooltip>
                ) : (
                  <CircularProgress size={20} />
                )}
                <Typography
                  variant="h6"
                  sx={{
                    textOverflow: "ellipsis",
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    minWidth: 0,
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
                  textOverflow: "ellipsis",
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                  minWidth: 0,
                  color: (theme) => theme.palette.grey[700],
                }}
                title={pipeline.path}
                data-test-id="pipeline-path"
              >
                {cleanFilePath(pipeline.path)}
              </Typography>
            </>
          )}
        </Stack>
        <Stack spacing={2} direction="row" justifyContent="flex-end">
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
