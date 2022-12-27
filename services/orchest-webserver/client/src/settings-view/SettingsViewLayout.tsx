import { SidePanelMenuItem } from "@/components/layout/SidePanelMenuItem";
import { ViewLayout } from "@/components/layout/ViewLayout";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
import Box from "@mui/material/Box";
import ListSubheader from "@mui/material/ListSubheader";
import MenuList from "@mui/material/MenuList";
import React from "react";

type SettingsViewLayoutProps = {
  children: React.ReactNode;
  header?: React.ReactNode;
  fixedWidth?: boolean;
};

export const SettingsViewLayout = ({
  children,
  header,
  fixedWidth = true,
}: SettingsViewLayoutProps) => (
  <ViewLayout
    sidePanel={<SettingsMenuList />}
    header={() => (
      <Box sx={{ marginBottom: (theme) => theme.spacing(2) }}>{header}</Box>
    )}
    fixedWidth={fixedWidth}
  >
    {children}
  </ViewLayout>
);

const menuItems = [
  { uuid: "general", title: "General", pathname: siteMap.settings.path },
  {
    uuid: "jupyter-lab",
    title: "JupyterLab configuration",
    pathname: siteMap.configureJupyterLab.path,
  },
  { uuid: "git", title: "Git & SSH", pathname: siteMap.configureGitSsh.path },
  {
    uuid: "notification",
    title: "Notifications",
    pathname: siteMap.notificationSettings.path,
  },
  {
    uuid: "user-management",
    title: "User management",
    pathname: siteMap.manageUsers.path,
  },
];

const SettingsMenuList = () => {
  const { location, navigateTo } = useCustomRoute();
  return (
    <MenuList
      sx={{
        overflowY: "auto",
        flexShrink: 1,
        paddingTop: 0,
      }}
      tabIndex={0} // MUI's MenuList default is -1
    >
      <ListSubheader sx={{ backgroundColor: "unset" }}>Settings</ListSubheader>
      {menuItems.map((item) => {
        return (
          <SidePanelMenuItem
            key={item.uuid}
            uuid={item.uuid}
            title={item.title}
            divider={false}
            selected={location.pathname === item.pathname}
            onClick={() => navigateTo(item.pathname)}
          />
        );
      })}
    </MenuList>
  );
};
