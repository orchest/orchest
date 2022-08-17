import {
  BUILD_IMAGE_SOLUTION_VIEW,
  useProjectsContext,
} from "@/contexts/ProjectsContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { hasValue } from "@orchest/lib-utils";
import React from "react";

export const useIsReadOnly = () => {
  const { jobUuid, runUuid } = useCustomRoute();
  const {
    dispatch,
    state: { pipelineReadOnlyReason, projectUuid },
    ensureEnvironmentsAreBuilt,
  } = useProjectsContext();

  const isJobRun = Boolean(runUuid && jobUuid);

  React.useEffect(() => {
    if (isJobRun) {
      dispatch({
        type: "SET_PIPELINE_READONLY_REASON",
        payload: "isJobRun",
      });
    }
  }, [isJobRun, dispatch]);

  React.useEffect(() => {
    if (!isJobRun && hasValue(projectUuid)) {
      ensureEnvironmentsAreBuilt(BUILD_IMAGE_SOLUTION_VIEW.PIPELINE);
    }
  }, [isJobRun, projectUuid, ensureEnvironmentsAreBuilt]);

  return pipelineReadOnlyReason;
};
