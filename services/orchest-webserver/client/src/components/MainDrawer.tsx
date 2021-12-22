import { useAppContext } from "@/contexts/AppContext";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import DeviceHubIcon from "@mui/icons-material/DeviceHub";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import PendingActionsIcon from "@mui/icons-material/PendingActions";
import SettingsIcon from "@mui/icons-material/Settings";
import ViewComfyIcon from "@mui/icons-material/ViewComfy";
import Divider from "@mui/material/Divider";
import MuiDrawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import { CSSObject, styled, Theme } from "@mui/material/styles";
import Toolbar from "@mui/material/Toolbar";
import React from "react";
import { matchPath, useLocation } from "react-router-dom";
import { siteMap, toQueryString } from "../routingConfig";

type ItemData = { label: string; icon: JSX.Element; path: string };

const getProjectMenuItems = (projectUuid: string): ItemData[] => [
  {
    label: "Pipelines",
    icon: <DeviceHubIcon />,
    path: `${siteMap.pipelines.path}${toQueryString({ projectUuid })}`,
  },
  {
    label: "Jobs",
    icon: <PendingActionsIcon />,
    path: `${siteMap.jobs.path}${toQueryString({ projectUuid })}`,
  },
  {
    label: "Environments",
    icon: <ViewComfyIcon />,
    path: `${siteMap.environments.path}${toQueryString({ projectUuid })}`,
  },
];

const rootMenuItems: ItemData[] = [
  {
    label: "Projects",
    icon: <FormatListBulletedIcon />,
    path: siteMap.projects.path,
  },
  {
    label: "File manager",
    icon: <FolderOpenIcon />,
    path: siteMap.fileManager.path,
  },
  {
    label: "Settings",
    icon: <SettingsIcon />,
    path: siteMap.settings.path,
  },
];

const getItemKey = (item: { label: string; path: string }) =>
  `menu-${item.label.toLowerCase().replace(/[\W]/g, "-")}`;

const DEFAULT_DRAWER_WIDTH = 240;

const openedMixin = (theme: Theme, drawerWidth?: number): CSSObject => ({
  width: drawerWidth,
  transition: theme.transitions.create("width", {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  }),
  overflowX: "hidden",
});

const closedMixin = (theme: Theme): CSSObject => ({
  transition: theme.transitions.create("width", {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  overflowX: "hidden",
  width: `calc(${theme.spacing(7)} + 1px)`,
});

const Drawer = styled(MuiDrawer, {
  shouldForwardProp: (prop) => prop !== "open",
})<{ drawerWidth?: number }>(
  ({ theme, open, drawerWidth = DEFAULT_DRAWER_WIDTH }) => ({
    width: drawerWidth,
    flexShrink: 0,
    whiteSpace: "nowrap",
    boxSizing: "border-box",
    ...(open && {
      ...openedMixin(theme, drawerWidth),
      "& .MuiDrawer-paper": openedMixin(theme, drawerWidth),
    }),
    ...(!open && {
      ...closedMixin(theme),
      "& .MuiDrawer-paper": closedMixin(theme),
    }),
  })
);

export const AppDrawer: React.FC<{ isOpen?: boolean }> = ({ isOpen }) => {
  const {
    state: { projectUuid },
  } = useProjectsContext();
  const appContext = useAppContext();
  const location = useLocation();
  const pathname = location.pathname;

  const { navigateTo } = useCustomRoute();

  const projectMenuItems = getProjectMenuItems(projectUuid);

  React.useEffect(() => {
    if (appContext.state.config?.CLOUD && window.Intercom !== undefined) {
      // show Intercom widget
      window.Intercom("update", {
        hide_default_launcher: !isOpen,
      });
    }
  }, [isOpen]);

  const isSelected = (path: string, exact = false) => {
    return matchPath(pathname, { path: path.split("?")[0], exact }) !== null;
  };

  return (
    <Drawer variant="permanent" open={isOpen}>
      <Toolbar />
      <List>
        {projectMenuItems.map((item) => {
          const id = getItemKey(item);
          return (
            <ListItemButton
              id={id}
              key={id}
              data-test-id={id}
              onClick={() => navigateTo(item.path)}
              selected={isSelected(item.path, false)}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText key={`${item.label}-text`} primary={item.label} />
            </ListItemButton>
          );
        })}
      </List>
      <Divider />
      <List>
        {rootMenuItems.map((item) => {
          const id = getItemKey(item);
          return (
            <ListItemButton
              id={id}
              key={id}
              data-test-id={id}
              selected={isSelected(item.path, true)}
              onClick={() => navigateTo(item.path)}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          );
        })}
      </List>
    </Drawer>
  );
};
