import { useEnvironmentsApi } from "@/api/environments/useEnvironmentsApi";
import { ViewLayout } from "@/components/layout/ViewLayout";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { siteMap } from "@/routingConfig";
import React from "react";
import { EditEnvironment } from "./edit-environment/EditEnvironment";
import { EnvironmentHeader } from "./EnvironmentHeader";
import { EnvironmentMenuList } from "./EnvironmentMenuList";

export const EnvironmentsView = () => {
  useSendAnalyticEvent("view:loaded", { name: siteMap.environments.path });

  const hasEnvironments = useEnvironmentsApi(
    (state) => state.environments?.length !== 0
  );

  return (
    <ViewLayout
      sidePanel={<EnvironmentMenuList />}
      header={hasEnvironments ? () => <EnvironmentHeader /> : undefined}
    >
      <EditEnvironment />
    </ViewLayout>
  );
};
