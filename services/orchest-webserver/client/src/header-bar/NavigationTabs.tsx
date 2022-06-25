import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useMatchRoutePaths } from "@/hooks/useMatchProjectRoot";
import { withinProjectPaths } from "@/routingConfig";
import { useTheme } from "@mui/material/styles";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import React from "react";
import { getProjectMenuItems } from "./common";
import { useNavTabIndex } from "./useNavTabIndex";

export const NavigationTabs = () => {
  const { navigateTo } = useCustomRoute();
  const matchRoute = useMatchRoutePaths(withinProjectPaths);

  const {
    state: { projectUuid },
  } = useProjectsContext();

  const navItems = React.useMemo(() => {
    return getProjectMenuItems(projectUuid);
  }, [projectUuid]);

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
        return (
          <Tab
            key={menuItem.label}
            label={menuItem.label}
            disableRipple
            sx={{
              height: (theme) => theme.spacing(7),
              "&.Mui-selected": {
                color: (theme) => theme.palette.common.black,
              },
            }}
            aria-controls={`navigate-to-${menuItem.label}`}
            onClick={() => onClickTab(index)}
          />
        );
      })}
    </Tabs>
  );
};
