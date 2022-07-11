import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useMatchRoutePaths } from "@/hooks/useMatchProjectRoot";
import { navigationRoutes, siteMap } from "@/routingConfig";
import HelpOutlineOutlinedIcon from "@mui/icons-material/HelpOutlineOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import Box from "@mui/material/Box";
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

export const NavigationTabsBase = ({
  disabled,
  navItems,
}: {
  disabled?: boolean;
  navItems: NavItem[];
}) => {
  const { navigateTo } = useCustomRoute();

  const matchRoute = useMatchRoutePaths(navigationRoutes);

  const navTabIndex = useNavTabIndex({ matchRoute, navItems });

  // `useNavTabIndex` will update navTabIndex based on the URL route.
  // Therefor, it's not necessary to manipulate the value of `Tabs` using `onChange`.
  const onClickTab = (itemIndex: number) => {
    navigateTo(navItems[itemIndex].path);
  };
  const theme = useTheme();

  return (
    <Tabs
      value={navTabIndex}
      aria-label="Navigation items"
      TabIndicatorProps={{
        style: { backgroundColor: theme.palette.common.black },
      }}
    >
      {navItems.map((menuItem, index) => {
        const isDisabled = !menuItem.icon && disabled;
        const hideTooltip = !menuItem.icon && !disabled;
        // CustomTab needs to be wrapped by Box because Tooltip will stop working if it detects its direct children is disabled.
        return (
          <Tooltip
            key={menuItem.label}
            title={
              isDisabled
                ? "First create a Project to navigate here"
                : menuItem.label
            }
            disableHoverListener={hideTooltip}
          >
            <Box sx={{ cursor: isDisabled ? "not-allowed" : "initial" }}>
              <CustomTab
                key={menuItem.label}
                tabIndex={0}
                disabled={!menuItem.icon && disabled}
                label={menuItem.icon ? undefined : menuItem.label}
                icon={menuItem.icon}
                aria-label={menuItem.label}
                onClick={() => onClickTab(index)}
                onAuxClick={() => onClickTab(index)}
              />
            </Box>
          </Tooltip>
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
  const navItems = React.useMemo(() => {
    const projectMenuItems = getProjectMenuItems(projectUuid, pipeline?.uuid);
    return [...projectMenuItems, ...systemMenuItems];
  }, [projectUuid, pipeline?.uuid]);

  return <NavigationTabsBase disabled={disabled} navItems={navItems} />;
};
