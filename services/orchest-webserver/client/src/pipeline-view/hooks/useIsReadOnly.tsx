import { useProjectsContext } from "@/contexts/ProjectsContext";
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

  return pipelineIsReadOnly;
};
