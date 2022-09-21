import { useEnvironmentsApi } from "@/api/environments/useEnvironmentsApi";
import {
  PipelineReadOnlyReason,
  useProjectsContext,
} from "@/contexts/ProjectsContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import React from "react";

/**
 * Update pipelineReadOnlyReason per environment build status and job runs.
 */
export const useIsReadOnly = () => {
  const { jobUuid, runUuid, snapshotUuid } = useCustomRoute();
  const { dispatch } = useProjectsContext();

  const status = useEnvironmentsApi((state) => state.status);

  const pipelineReadOnlyReason: PipelineReadOnlyReason | undefined = Boolean(
    snapshotUuid
  )
    ? "isSnapshot"
    : Boolean(runUuid && jobUuid)
    ? "isJobRun"
    : status !== "allEnvironmentsBuilt"
    ? status
    : undefined;

  React.useEffect(() => {
    dispatch({
      type: "SET_PIPELINE_READONLY_REASON",
      payload: pipelineReadOnlyReason,
    });
  }, [pipelineReadOnlyReason, dispatch]);
};
