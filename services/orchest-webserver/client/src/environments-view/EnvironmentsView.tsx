import { LayoutWithSidePanel } from "@/components/Layout/layout-with-side-panel/LayoutWithSidePanel";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { siteMap } from "@/routingConfig";
import React from "react";
import { EnvironmentMenuList } from "./EnvironmentMenuList";
import { useFetchEnvironments } from "./stores/useFetchEnvironments";

export const EnvironmentsView = () => {
  useSendAnalyticEvent("view:loaded", { name: siteMap.environments.path });
  const { projectUuid } = useCustomRoute();
  useFetchEnvironments(projectUuid);

  return (
    <LayoutWithSidePanel sidePanel={<EnvironmentMenuList />}>
      {/* <EnvironmentList projectUuid={projectUuid} /> */}
    </LayoutWithSidePanel>
  );
};
