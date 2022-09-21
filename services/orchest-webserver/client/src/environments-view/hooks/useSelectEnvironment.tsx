import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
import React from "react";

/**
 * Provides `selectEnvironment` that navigate to the Environment.
 */
export const useSelectEnvironment = () => {
  const { navigateTo, projectUuid } = useCustomRoute();

  const selectEnvironment = React.useCallback(
    (uuid: string) => {
      if (projectUuid) {
        navigateTo(siteMap.environments.path, {
          query: { projectUuid, environmentUuid: uuid },
        });
      }
    },
    [navigateTo, projectUuid]
  );

  return { selectEnvironment };
};
