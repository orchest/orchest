import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
import React from "react";

/**
 * Provides `selectJob` that navigate to the Environment.
 */
export const useSelectJob = () => {
  const { navigateTo, projectUuid } = useCustomRoute();

  const selectJob = React.useCallback(
    (jobUuid: string) => {
      if (projectUuid) {
        navigateTo(siteMap.jobs.path, {
          query: { projectUuid, jobUuid },
        });
      }
    },
    [navigateTo, projectUuid]
  );

  return { selectJob };
};
