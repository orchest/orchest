import { useEnvironmentsApi } from "@/api/environments/useEnvironmentsApi";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import React from "react";

/**
 * Update pipelineReadOnlyReason per environment build status and job runs.
 */
export const useIsReadOnly = () => {
  const { jobUuid, runUuid } = useCustomRoute();
  const { dispatch } = useProjectsContext();

  const status = useEnvironmentsApi((state) => state.status);

  const isJobRun = Boolean(runUuid && jobUuid);

  React.useEffect(() => {
    if (isJobRun) {
      dispatch({
        type: "SET_PIPELINE_READONLY_REASON",
        payload: "isJobRun",
      });
    } else {
      const payload = status === "allEnvironmentsBuilt" ? undefined : status;
      dispatch({
        type: "SET_PIPELINE_READONLY_REASON",
        payload,
      });
    }
  }, [isJobRun, status, dispatch]);
};
