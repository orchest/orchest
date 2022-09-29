import { LayoutWithSidePanel } from "@/components/Layout/LayoutWithSidePanel";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { siteMap } from "@/routingConfig";
import React from "react";
import { EditEnvironment } from "./edit-environment/EditEnvironment";
import { EnvironmentHeader } from "./EnvironmentHeader";
import { EnvironmentMenuList } from "./EnvironmentMenuList";

export const EnvironmentsView = () => {
  useSendAnalyticEvent("view:loaded", { name: siteMap.environments.path });

  return (
    <LayoutWithSidePanel
      sidePanel={<EnvironmentMenuList />}
      header={<EnvironmentHeader />}
    >
      <EditEnvironment />
    </LayoutWithSidePanel>
  );
};
