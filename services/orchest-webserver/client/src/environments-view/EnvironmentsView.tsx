import { LayoutWithSidePanel } from "@/components/Layout/layout-with-side-panel/LayoutWithSidePanel";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { siteMap } from "@/routingConfig";
import React from "react";
import EnvironmentList from "./EnvironmentList";
import { EnvironmentMenuList } from "./EnvironmentMenuList";

export const EnvironmentsView = () => {
  const { projectUuid } = useCustomRoute();
  useSendAnalyticEvent("view:loaded", { name: siteMap.environments.path });

  return (
    <LayoutWithSidePanel sidePanel={<EnvironmentMenuList />}>
      <EnvironmentList projectUuid={projectUuid} />
    </LayoutWithSidePanel>
  );
};
