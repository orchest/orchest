import { LayoutWithSidePanel } from "@/components/Layout/layout-with-side-panel/LayoutWithSidePanel";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { siteMap } from "@/routingConfig";
import React from "react";
import { EditJob } from "./edit-job/EditJob";
import { JobMenuList } from "./JobMenuList";

export const JobsView = () => {
  useSendAnalyticEvent("view:loaded", { name: siteMap.environments.path });

  return (
    <LayoutWithSidePanel
      sidePanel={<JobMenuList />}
      mainContainerProps={{ sx: { paddingTop: 0 } }}
    >
      <EditJob />
    </LayoutWithSidePanel>
  );
};
