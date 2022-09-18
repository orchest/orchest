import { LayoutWithSidePanel } from "@/components/Layout/layout-with-side-panel/LayoutWithSidePanel";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { siteMap } from "@/routingConfig";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { JobView } from "./job-view/JobView";
import { JobMenuList } from "./JobMenuList";

export const JobsView = () => {
  useSendAnalyticEvent("view:loaded", { name: siteMap.environments.path });
  const { jobUuid } = useCustomRoute();

  return (
    <LayoutWithSidePanel
      sidePanel={<JobMenuList />}
      mainContainerProps={{ sx: { paddingTop: 0 } }}
    >
      {hasValue(jobUuid) && <JobView />}
    </LayoutWithSidePanel>
  );
};
