import { useOrchestConfigsApi } from "@/api/system-config/useOrchestConfigsApi";
import { IconButton } from "@/components/common/IconButton";
import LogoutIcon from "@mui/icons-material/Logout";
import AppBar from "@mui/material/AppBar";
import Stack from "@mui/material/Stack";
import Toolbar from "@mui/material/Toolbar";
import React from "react";
import { ProjectSelector } from "../project-selector/ProjectSelector";
import { NavigationTabs } from "./NavigationTabs";
import { SessionStatus } from "./SessionStatus";

export const HeaderBar = () => {
  const userConfig = useOrchestConfigsApi((state) => state.userConfig);

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
        height: (theme) => theme.spacing(7),
      }}
    >
      <SessionStatus />

      <Toolbar
        variant="dense"
        sx={{ justifyContent: "space-between", paddingLeft: "0 !important" }}
      >
        <ProjectSelector />
        <Stack direction="row" justifyContent="flex-end">
          <NavigationTabs />
          {userConfig?.AUTH_ENABLED && (
            <IconButton
              title="Logout"
              tabIndex={0}
              onClick={logoutHandler}
              sx={{
                color: (theme) => theme.palette.action.active,
                width: (theme) => theme.spacing(7),
              }}
            >
              <LogoutIcon />
            </IconButton>
          )}
        </Stack>
      </Toolbar>
    </AppBar>
  );
};
