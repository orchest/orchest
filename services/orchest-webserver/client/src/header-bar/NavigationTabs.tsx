import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useMatchRoutePaths } from "@/hooks/useMatchProjectRoot";
import { navigationRoutes, siteMap } from "@/routingConfig";
import { isNumber } from "@/utils/webserver-utils";
import HelpOutlineOutlinedIcon from "@mui/icons-material/HelpOutlineOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import { useTheme } from "@mui/material/styles";
import Tabs from "@mui/material/Tabs";
import Tooltip from "@mui/material/Tooltip";
import React from "react";
import { getProjectMenuItems, NavItem } from "./common";
import { CustomTab } from "./CustomTab";
import { useNavTabIndex } from "./useNavTabIndex";

const systemMenuItems: NavItem[] = [
  {
    label: "Settings",
    icon: <SettingsOutlinedIcon />,
    path: siteMap.settings.path,
  },
  {
    label: "Help",
    icon: <HelpOutlineOutlinedIcon />,
    path: siteMap.help.path,
  },
];

const NavigationTabsTooltip: React.FC = ({ children }) => {
  return (
    <Tooltip title="First create a Project to navigate here" followCursor>
      <Box sx={{ cursor: "not-allowed" }}>{children}</Box>
    </Tooltip>
  );
};

type NavigationTabsBaseProps = {
  disabled: boolean;
  projectMenuItems: NavItem[];
};

export const NavigationTabsBase = ({
  disabled,
  projectMenuItems,
}: NavigationTabsBaseProps) => {
  const { navigateTo } = useCustomRoute();

  const matchRoute = useMatchRoutePaths(navigationRoutes);

  const navItems = React.useMemo(
    () =>
      disabled ? systemMenuItems : [...projectMenuItems, ...systemMenuItems],
    [projectMenuItems, disabled]
  );

  const navTabIndex = useNavTabIndex({ matchRoute, navItems });

  // `useNavTabIndex` will update navTabIndex based on the URL route.
  // Therefor, it's not necessary to manipulate the value of `Tabs` using `onChange`.
  const onClickTab = (itemIndex: number) => {
    navigateTo(navItems[itemIndex].path);
  };
  const theme = useTheme();

  // It's illegal to wrap Tab with Tooltip. So the Tooltip needs to wrap Tabs
  // When disabled is true, render projectMenuItems and systemMenuItems separately.
  return disabled ? (
    <Stack direction="row">
      <NavigationTabsTooltip>
        <Tabs value={false} aria-label="Navigation items" disabled={disabled}>
          {projectMenuItems.map((menuItem) => {
            return (
              <CustomTab
                key={menuItem.label}
                tabIndex={0}
                label={menuItem.label}
                icon={menuItem.icon}
                aria-label={menuItem.label}
                disabled
              />
            );
          })}
        </Tabs>
      </NavigationTabsTooltip>
      <Tabs
        value={
          isNumber(navTabIndex)
            ? Math.min(navTabIndex, navItems.length - 1)
            : navTabIndex
        }
        aria-label="Navigation items"
        TabIndicatorProps={{
          style: { backgroundColor: theme.palette.common.black },
        }}
      >
        {systemMenuItems.map((menuItem, index) => {
          return (
            <CustomTab
              key={menuItem.label}
              tabIndex={0}
              disabled={!menuItem.icon && disabled}
              label={menuItem.label}
              icon={menuItem.icon}
              aria-label={menuItem.label}
              onClick={() => onClickTab(index)}
              onAuxClick={() => onClickTab(index)}
            />
          );
        })}
      </Tabs>
    </Stack>
  ) : (
    <Tabs
      value={navTabIndex}
      aria-label="Navigation items"
      TabIndicatorProps={{
        style: { backgroundColor: theme.palette.common.black },
      }}
    >
      {navItems.map((menuItem, index) => {
        return (
          <CustomTab
            key={menuItem.label}
            tabIndex={0}
            disabled={!menuItem.icon && disabled}
            label={menuItem.label}
            icon={menuItem.icon}
            aria-label={menuItem.label}
            onClick={() => onClickTab(index)}
            onAuxClick={() => onClickTab(index)}
          />
        );
      })}
    </Tabs>
  );
};

export const NavigationTabs = () => {
  const {
    state: { projects = [], hasLoadedProjects, projectUuid, pipeline },
  } = useProjectsContext();

  const disabled = hasLoadedProjects && projects.length === 0;

  const projectMenuItems = React.useMemo(() => {
    return getProjectMenuItems(projectUuid, pipeline?.uuid);
  }, [projectUuid, pipeline?.uuid]);

  return (
    <NavigationTabsBase
      disabled={disabled}
      projectMenuItems={projectMenuItems}
    />
  );
};
