import { useAppContext } from "@/contexts/AppContext";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { toQueryString } from "@/utils/routing";
import { toValidFilename } from "@/utils/toValidFilename";
import DeviceHubIcon from "@mui/icons-material/DeviceHub";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import PendingActionsIcon from "@mui/icons-material/PendingActions";
import SettingsIcon from "@mui/icons-material/Settings";
import ViewComfyIcon from "@mui/icons-material/ViewComfy";
import Divider from "@mui/material/Divider";
import MuiDrawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import MuiListItemIcon from "@mui/material/ListItemIcon";
import MuiListItemText, { ListItemTextProps } from "@mui/material/ListItemText";
import { CSSObject, styled, Theme } from "@mui/material/styles";
import Toolbar from "@mui/material/Toolbar";
import React from "react";
import { matchPath, useLocation } from "react-router-dom";
import { getOrderedRoutes, siteMap } from "../routingConfig";

type ItemData = { label: string; icon: JSX.Element; path: string };

const getProjectMenuItems = (projectUuid: string | undefined): ItemData[] => {
  const queryString = projectUuid ? toQueryString({ projectUuid }) : "";
  return [
    {
      label: "Pipelines",
      icon: <DeviceHubIcon />,
      path: `${siteMap.pipeline.path}${queryString}`,
    },
    {
      label: "Jobs",
      icon: <PendingActionsIcon />,
      path: `${siteMap.jobs.path}${queryString}`,
    },
    {
      label: "Environments",
      icon: <ViewComfyIcon />,
      path: `${siteMap.environments.path}${queryString}`,
    },
  ];
};

const rootMenuItems: ItemData[] = [
  {
    label: "Projects",
    icon: <FormatListBulletedIcon />,
    path: siteMap.projects.path,
  },
  {
    label: "Settings",
    icon: <SettingsIcon />,
    path: siteMap.settings.path,
  },
];

const getItemKey = (item: { label: string; path: string }) =>
  `menu-${toValidFilename(item.label)}`;

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

const ListItemIcon = styled(MuiListItemIcon)(({ theme }) => ({
  minWidth: theme.spacing(5.5),
}));

const ListItemText = (props: ListItemTextProps) => {
  return (
    <MuiListItemText
      primaryTypographyProps={{
        sx: (theme) => theme.typography.body2,
      }}
      {...props}
    />
  );
};

const routes = getOrderedRoutes();

export const AppDrawer: React.FC<{ isOpen?: boolean }> = ({ isOpen }) => {
  const {
    state: { projectUuid },
  } = useProjectsContext();
  const { config } = useAppContext();
  const location = useLocation();
  const pathname = location.pathname;

  const { navigateTo } = useCustomRoute();

  const projectMenuItems = getProjectMenuItems(projectUuid);

  React.useEffect(() => {
    if (config?.CLOUD && window.Intercom !== undefined) {
      // show Intercom widget
      window.Intercom("update", {
        hide_default_launcher: !isOpen,
      });
    }
  }, [isOpen, config]);

  const isSelected = (path: string, exact = false) => {
    const route = routes.find((route) => route.path === pathname);
    const pathToMatch = route?.root || route?.path || pathname;

    return (
      matchPath(pathToMatch, {
        path: path.split("?")[0],
        exact,
      }) !== null
    );
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
              onClick={(e) => navigateTo(item.path, undefined, e)}
              onAuxClick={(e) => navigateTo(item.path, undefined, e)}
              selected={isSelected(item.path, false)}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText
                key={`${item.label}-text`} // we need to give a key to register the element
                primary={item.label}
              />
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
              onClick={(e) => navigateTo(item.path, undefined, e)}
              onAuxClick={(e) => navigateTo(item.path, undefined, e)}
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
