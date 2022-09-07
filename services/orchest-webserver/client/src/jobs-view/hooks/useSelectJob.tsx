import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
import React from "react";
import { useUpdateJobOnUnmount } from "./useUpdateJobOnUnmount";

/**
 * Provides `selectJob` that navigate to the Environment.
 */
export const useSelectJob = () => {
  const { navigateTo, projectUuid } = useCustomRoute();
  const { updateJobAndReset } = useUpdateJobOnUnmount();

  const saveAndRedirect = React.useCallback(
    (jobUuid: string) => {
      updateJobAndReset();
      navigateTo(siteMap.jobs.path, {
        query: { projectUuid, jobUuid },
      });
    },
    [navigateTo, projectUuid, updateJobAndReset]
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
