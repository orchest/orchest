import { ViewLayout } from "@/components/layout";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { siteMap } from "@/routingConfig";
import React from "react";
import { EditEnvironment } from "./edit-environment/EditEnvironment";
import { EnvironmentHeader } from "./EnvironmentHeader";
import { EnvironmentMenuList } from "./EnvironmentMenuList";

export const EnvironmentsView = () => {
  useSendAnalyticEvent("view:loaded", { name: siteMap.environments.path });

  return (
    <ViewLayout
      sidePanel={<EnvironmentMenuList />}
      header={() => <EnvironmentHeader />}
    >
      <EditEnvironment />
    </ViewLayout>
  );
};
