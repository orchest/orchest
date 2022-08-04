import { useEnvironmentsApi } from "@/api/environments/useEnvironmentsApi";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
import React from "react";
import { useSelectEnvironmentUuid } from "../stores/useSelectEnvironmentUuid";
import { useSyncEnvironmentUuidWithQueryArgs } from "./useSyncEnvironmentUuidWithQueryArgs";

export const useSelectEnvironment = () => {
  const { navigateTo } = useCustomRoute();
  const { environmentUuid } = useSelectEnvironmentUuid();
  const { projectUuid, environments } = useEnvironmentsApi();
  useSyncEnvironmentUuidWithQueryArgs();

  const environmentOnEdit = React.useMemo(() => {
    const foundEnvironment = environmentUuid
      ? environments?.find((env) => env.uuid === environmentUuid)
      : environments?.[0];

    return foundEnvironment?.uuid;
  }, [environments, environmentUuid]);

  const selectEnvironment = React.useCallback(
    (uuid: string) => {
      navigateTo(siteMap.environments.path, {
        query: { projectUuid, environmentUuid: uuid },
      });
    },
    [navigateTo, projectUuid]
  );

  return { environments, selectEnvironment, environmentOnEdit };
};
