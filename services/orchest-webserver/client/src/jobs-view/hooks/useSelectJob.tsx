import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
import React from "react";

/**
 * Provides `selectJob` that navigate to the Environment.
 */
export const useSelectJob = () => {
  const { navigateTo, projectUuid } = useCustomRoute();

  const saveAndRedirect = React.useCallback(
    (jobUuid: string) => {
      navigateTo(siteMap.jobs.path, {
        query: { projectUuid, jobUuid },
      });
    },
    [navigateTo, projectUuid]
  );

  const selectJob = React.useCallback(
    (jobUuid: string) => {
      if (!projectUuid) return;
      saveAndRedirect(jobUuid);
    },
    [projectUuid, saveAndRedirect]
  );

  return { selectJob };
};
