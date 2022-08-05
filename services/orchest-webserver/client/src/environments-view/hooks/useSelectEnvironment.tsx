import { useEnvironmentsApi } from "@/api/environments/useEnvironmentsApi";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
import React from "react";
import { findEnvironment } from "../common";
import { useEnvironmentOnEdit } from "../stores/useEnvironmentOnEdit";

/**
 * Provides `selectEnvironment` that loads environmentOnEdit and also navigate to the
 * view accordingly.
 */
export const useSelectEnvironment = () => {
  const { navigateTo } = useCustomRoute();

  const { projectUuid, environments } = useEnvironmentsApi();

  const { initEnvironmentOnEdit } = useEnvironmentOnEdit();

  const selectEnvironment = React.useCallback(
    (uuid: string) => {
      const targetEnvironment = findEnvironment(environments, uuid);
      if (targetEnvironment) {
        initEnvironmentOnEdit(targetEnvironment);
        navigateTo(siteMap.environments.path, {
          query: { projectUuid, environmentUuid: uuid },
        });
      }
    },
    [environments, navigateTo, projectUuid, initEnvironmentOnEdit]
  );

  return { selectEnvironment };
};
