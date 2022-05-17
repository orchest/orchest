import { useAppContext } from "@/contexts/AppContext";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { checkGate } from "@/utils/webserver-utils";
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

  const hasActiveRun = hasValue(runUuid && jobUuid);

  React.useEffect(() => {
    if (hasActiveRun) setIsReadOnly(true);
  }, [hasActiveRun, setIsReadOnly]);

  // Check gate is needed whenever user enters Pipeline Editor,
  // `useAutoStartSession` only cares about the "current" pipeline that is opened in the Pipeline Editor,
  // but it's needed to check ALL sessions in the project.
  React.useEffect(() => {
    if (!hasActiveRun && hasValue(projectUuid)) {
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
