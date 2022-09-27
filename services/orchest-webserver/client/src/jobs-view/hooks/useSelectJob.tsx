import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
import React from "react";

/**
 * Provides `selectJob` that navigate to the Job.
 */
export const useSelectJob = () => {
  const { navigateTo, projectUuid } = useCustomRoute();

  const redirect = React.useCallback(
    (event: React.MouseEvent | undefined, jobUuid: string) => {
      navigateTo(siteMap.jobs.path, { query: { projectUuid, jobUuid } }, event);
    },
    [navigateTo, projectUuid]
  );

  const selectJob = React.useCallback(
    (event: React.MouseEvent | undefined, jobUuid: string) => {
      if (!projectUuid) return;
      redirect(event, jobUuid);
    },
    [projectUuid, redirect]
  );

  return { selectJob };
};
