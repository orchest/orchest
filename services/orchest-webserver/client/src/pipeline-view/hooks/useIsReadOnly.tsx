import { useAppContext } from "@/contexts/AppContext";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { checkGate } from "@/utils/webserver-utils";
import React from "react";

export const useIsReadOnly = (
  projectUuid: string,
  jobUuid: string,
  runUuid: string
) => {
  const {
    dispatch,
    state: { pipelineIsReadOnly },
  } = useProjectsContext();
  const { requestBuild } = useAppContext();

  const setIsReadOnly = React.useCallback(
    (value: boolean) => {
      dispatch({
        type: "SET_PIPELINE_IS_READONLY",
        payload: value,
      });
    },
    [dispatch]
  );

  const hasActiveRun = runUuid && jobUuid;

  React.useEffect(() => {
    if (hasActiveRun) setIsReadOnly(true);
  }, [hasActiveRun, setIsReadOnly]);

  React.useEffect(() => {
    if (!hasActiveRun) {
      // for non pipelineRun - read only check gate
      checkGate(projectUuid)
        .then(() => {
          setIsReadOnly(false);
        })
        .catch((result) => {
          if (result.reason === "gate-failed") {
            setIsReadOnly(true);
            requestBuild(projectUuid, result.data, "Pipeline", () => {
              setIsReadOnly(false);
            });
          }
        });
    }
  }, [hasActiveRun, projectUuid, requestBuild, setIsReadOnly]);

  return pipelineIsReadOnly;
};
