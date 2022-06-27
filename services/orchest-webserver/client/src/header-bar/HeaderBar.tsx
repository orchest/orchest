import { useAppContext } from "@/contexts/AppContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useSessionsPoller } from "@/hooks/useSessionsPoller";
import { siteMap } from "@/routingConfig";
import HelpIcon from "@mui/icons-material/Help";
import LogoutIcon from "@mui/icons-material/Logout";
import AppBar from "@mui/material/AppBar";
import Stack from "@mui/material/Stack";
import Toolbar from "@mui/material/Toolbar";
import React from "react";
import { IconButton } from "../components/common/IconButton";
import { ProjectSelector } from "../project-selector/ProjectSelector";
import { NavigationTabs } from "./NavigationTabs";

export const HeaderBar = () => {
  const { navigateTo } = useCustomRoute();
  const { user_config } = useAppContext();
  useSessionsPoller();

  const showHelp = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    navigateTo(siteMap.help.path, undefined, e);
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
