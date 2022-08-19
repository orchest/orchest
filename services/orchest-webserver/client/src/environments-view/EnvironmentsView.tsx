import { LayoutWithSidePanel } from "@/components/Layout/layout-with-side-panel/LayoutWithSidePanel";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { siteMap } from "@/routingConfig";
import React from "react";
import { EditEnvironment } from "./edit-environment/EditEnvironment";
import { EnvironmentMenuList } from "./EnvironmentMenuList";

export const EnvironmentsView = () => {
  useSendAnalyticEvent("view:loaded", { name: siteMap.environments.path });

  return (
    <LayoutWithSidePanel
      sidePanel={<EnvironmentMenuList />}
      mainContainerProps={{ sx: { paddingTop: 0 } }}
    >
      <EditEnvironment />
    </LayoutWithSidePanel>
  );
};
