import {
  BUILD_IMAGE_SOLUTION_VIEW,
  useProjectsContext,
} from "@/contexts/ProjectsContext";
import { hasValue } from "@orchest/lib-utils";
import React from "react";

export const useIsReadOnly = (
  projectUuid: string | undefined,
  jobUuid: string | undefined,
  runUuid: string | undefined
) => {
  const {
    dispatch,
    state: { pipelineIsReadOnly },
    ensureEnvironmentsAreBuilt,
  } = useProjectsContext();

  const setIsReadOnly = React.useCallback(
    (value: boolean) => {
      dispatch({
        type: "SET_PIPELINE_IS_READONLY",
        payload: value,
      });
    },
    [dispatch]
  );

  const hasActiveRun = hasValue(runUuid && jobUuid);

  React.useEffect(() => {
    if (hasActiveRun) setIsReadOnly(true);
  }, [hasActiveRun, setIsReadOnly]);

  React.useEffect(() => {
    if (!hasActiveRun && hasValue(projectUuid)) {
      ensureEnvironmentsAreBuilt(BUILD_IMAGE_SOLUTION_VIEW.PIPELINE);
    }
  }, [hasActiveRun, projectUuid, ensureEnvironmentsAreBuilt]);

  return pipelineIsReadOnly;
};
