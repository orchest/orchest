import { useAppContext } from "@/contexts/AppContext";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useMatchRoutePaths } from "@/hooks/useMatchProjectRoot";
import { navigationRoutes, siteMap } from "@/routingConfig";
import HelpOutlineOutlinedIcon from "@mui/icons-material/HelpOutlineOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import { useTheme } from "@mui/material/styles";
import Tabs from "@mui/material/Tabs";
import { hasValue } from "@orchest/lib-utils";
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

export const NavigationTabs = () => {
  const { setConfirm } = useAppContext();
  const { navigateTo, location } = useCustomRoute();
  const matchRoute = useMatchRoutePaths(navigationRoutes);

  const {
    state: { projectUuid, pipeline, pipelines },
  } = useProjectsContext();

  const navItems = React.useMemo(() => {
    if (!projectUuid) return systemMenuItems;
    const projectMenuItems = getProjectMenuItems(projectUuid, pipeline?.uuid);
    return [...projectMenuItems, ...systemMenuItems];
  }, [projectUuid, pipeline?.uuid]);

  const navTabIndex = useNavTabIndex({ matchRoute, navItems });

  const hasPipelines = hasValue(pipelines) && pipelines.length > 0;

  // `useNavTabIndex` will update navTabIndex based on the URL route.
  // Therefor, it's not necessary to manipulate the value of `Tabs` using `onChange`.
  const onClickTab = (itemIndex: number) => {
    if (projectUuid && !hasPipelines && itemIndex === 1) {
      setConfirm(
        "Note",
        "No pipeline found in this project. You need a pipeline to start with.",
        {
          onConfirm: async (resolve) => {
            if (location.pathname !== siteMap.pipeline.path)
              navigateTo(siteMap.pipeline.path, { query: { projectUuid } });
            resolve(true);
            return true;
          },
          confirmLabel: "Go to pipelines",
        }
      );
      return;
    }
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
        return (
          <CustomTab
            key={menuItem.label}
            label={menuItem.icon ? undefined : menuItem.label}
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
