import { siteMap } from "@/routingConfig";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useHistory } from "react-router-dom";
import { useProjectTabsContext } from "./ProjectTabsContext";

const projectTabs = ["My projects", "Example projects"];

export const ProjectsTabs = ({
  children,
}: {
  children?: (projectTabIndex: number) => React.ReactNode;
}) => {
  const { projectTabIndex, setProjectTabIndex } = useProjectTabsContext();
  const history = useHistory();
  const selectTab = React.useCallback(
    (tabIndex: number) => {
      setProjectTabIndex(tabIndex);
      // This is to persist the nice MUI Tabs transition.
      window.setTimeout(() => {
        history.replace(`${siteMap.projects.path}?tab=${tabIndex}`);
      }, 500);
    },
    [setProjectTabIndex, history]
    // [setProjectTabIndex]
  );
  return (
    <>
      <Tabs
        value={projectTabIndex}
        aria-label="Projects tabs"
        sx={{ borderBottom: (theme) => `1px solid ${theme.borderColor}` }}
      >
        {projectTabs.map((projectTab, index) => {
          return (
            <Tab
              key={projectTab}
              label={projectTab}
              aria-label={projectTab}
              sx={{
                minWidth: (theme) => theme.spacing(24),
                paddingLeft: (theme) => theme.spacing(1),
                paddingRight: (theme) => theme.spacing(1),
              }}
              onClick={() => selectTab(index)}
              onAuxClick={() => selectTab(index)}
            />
          );
        })}
      </Tabs>
      {hasValue(children) ? children(projectTabIndex) : null}
    </>
  );
};
