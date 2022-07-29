import {
  EnvironmentsApiState,
  useEnvironmentsApi,
} from "@/api/environments/useEnvironmentsApi";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
import React from "react";

const selector = (state: EnvironmentsApiState) => state.environments;

export const useSelectEnvironment = () => {
  const { projectUuid, environmentUuid, navigateTo } = useCustomRoute();

  const environments = useEnvironmentsApi(selector);

  const environmentOnEdit = React.useMemo(() => {
    const found = environmentUuid
      ? environments?.find((env) => env.uuid === environmentUuid)
      : environments?.[0];

    return found || environments?.[0];
  }, [environments, environmentUuid]);

  const selectEnvironment = React.useCallback(
    (uuid: string) => {
      navigateTo(siteMap.environments.path, {
        query: { projectUuid, environmentUuid: uuid },
      });
    },
    [navigateTo, projectUuid]
  );

  return { selectEnvironment, environments, environmentOnEdit };
};
