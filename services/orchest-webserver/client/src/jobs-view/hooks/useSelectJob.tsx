import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
import React from "react";
import { useEditJob } from "../stores/useEditJob";

/**
 * Provides `selectJob` that navigate to the Environment.
 */
export const useSelectJob = () => {
  const { navigateTo, projectUuid } = useCustomRoute();
  const resetJobChanges = useEditJob((state) => state.resetJobChanges);
  const selectJob = React.useCallback(
    (jobUuid: string) => {
      if (projectUuid) {
        resetJobChanges();
        navigateTo(siteMap.jobs.path, {
          query: { projectUuid, jobUuid },
        });
      }
    },
    [navigateTo, projectUuid, resetJobChanges]
  );

  return { selectJob };
};
