import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
import React from "react";

/**
 * Provides `selectJob` that navigate to the Job.
 */
export const useSelectJob = () => {
  const { navigateTo, projectUuid } = useCustomRoute();

  const redirect = React.useCallback(
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
      redirect(jobUuid);
    },
    [projectUuid, redirect]
  );

  return { selectJob };
};
