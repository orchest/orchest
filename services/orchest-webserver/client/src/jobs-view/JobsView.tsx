import { LayoutWithSidePanel } from "@/components/Layout/layout-with-side-panel/LayoutWithSidePanel";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { siteMap } from "@/routingConfig";
import React from "react";

export const JobsView = () => {
  useSendAnalyticEvent("view:loaded", { name: siteMap.environments.path });

  return (
    <LayoutWithSidePanel
      sidePanel={<></>}
      mainContainerProps={{ sx: { paddingTop: 0 } }}
    >
      <></>
    </LayoutWithSidePanel>
  );
};
