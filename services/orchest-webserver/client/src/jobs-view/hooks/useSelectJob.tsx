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
  const selectJob = React.useCallback(
    (jobUuid: string) => {
      if (projectUuid) {
        updateJobAndReset();
        navigateTo(siteMap.jobs.path, {
          query: { projectUuid, jobUuid },
        });
      }
    },
    [navigateTo, projectUuid, updateJobAndReset]
  );

  return { selectJob };
};
