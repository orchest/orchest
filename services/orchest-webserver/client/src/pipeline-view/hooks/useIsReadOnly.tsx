import {
  BUILD_IMAGE_SOLUTION_VIEW,
  useProjectsContext,
} from "@/contexts/ProjectsContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import React from "react";

export const useIsReadOnly = () => {
  const { jobUuid, runUuid: jobRunUuid } = useCustomRoute();

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

  /**
   * Note that runUuid could be two kinds:
   * - job run (always read-only): the UUID is retrieved from a job, so FE always gets it from the URL.
   * - interactive run (not read-only): the UUID of this run is only useful until the run is finished.
   *   So this kind of runUuid is NEVER from the URL.
   */
  const isJobRun = Boolean(jobRunUuid && jobUuid);

  React.useEffect(() => {
    // For inspecting a job run, it is ALWAYS read-only.
    if (isJobRun) {
      setIsReadOnly(true);
    }
    // For interactive runs, set it to read-only if any environment is not built.
    if (!isJobRun) {
      ensureEnvironmentsAreBuilt(
        BUILD_IMAGE_SOLUTION_VIEW.PIPELINE
      ).then((hasBuilt) => setIsReadOnly(!hasBuilt));
    }
  }, [isJobRun, ensureEnvironmentsAreBuilt, setIsReadOnly]);

  return pipelineIsReadOnly;
};
