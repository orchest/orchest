import { LayoutWithSidePanel } from "@/components/Layout/layout-with-side-panel/LayoutWithSidePanel";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { siteMap } from "@/routingConfig";
import React from "react";
import { EnvironmentMenuList } from "./EnvironmentMenuList";

export const EnvironmentsView = () => {
  useSendAnalyticEvent("view:loaded", { name: siteMap.environments.path });

  return (
    <LayoutWithSidePanel sidePanel={<EnvironmentMenuList />}>
      {/* <EnvironmentList projectUuid={projectUuid} /> */}
    </LayoutWithSidePanel>
  );
};
