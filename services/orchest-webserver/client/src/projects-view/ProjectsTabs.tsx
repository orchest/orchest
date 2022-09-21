import { useUpdateQueryArgs } from "@/hooks/useUpdateQueryArgs";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useProjectTabsContext } from "./ProjectTabsContext";

const projectTabs = ["My projects", "Example projects"];

type ProjectsTabsProps = {
  children?: (projectTabIndex: number) => React.ReactNode;
};

export const ProjectsTabs = ({ children }: ProjectsTabsProps) => {
  const { projectTabIndex, setProjectTabIndex } = useProjectTabsContext();
  const { updateQueryArgs } = useUpdateQueryArgs();

  const selectTab = React.useCallback(
    (tabIndex: number) => {
      setProjectTabIndex(tabIndex);
      // This is to persist the nice MUI Tabs transition.
      updateQueryArgs({ tab: tabIndex });
    },
    [setProjectTabIndex, updateQueryArgs]
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
