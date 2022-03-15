import { useAppContext } from "@/contexts/AppContext";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { checkGate } from "@/utils/webserver-utils";
import React from "react";

export const useIsReadOnly = (
  projectUuid: string,
  jobUuid: string,
  runUuid: string,
  initialValue: boolean
) => {
  const { dispatch } = useProjectsContext();
  const { requestBuild } = useAppContext();

  const [isReadOnly, setIsReadOnly] = React.useState(initialValue);

  React.useEffect(() => {
    dispatch({
      type: "SET_PIPELINE_IS_READONLY",
      payload: isReadOnly,
    });
  }, [dispatch, isReadOnly]);

  const hasActiveRun = runUuid && jobUuid;
  const isNonPipelineRun = !hasActiveRun && isReadOnly;

  React.useEffect(() => {
    if (isNonPipelineRun) {
      // for non pipelineRun - read only check gate
      let checkGatePromise = checkGate(projectUuid);
      checkGatePromise
        .then(() => {
          setIsReadOnly(false);
        })
        .catch((result) => {
          if (result.reason === "gate-failed") {
            requestBuild(projectUuid, result.data, "Pipeline", () => {
              setIsReadOnly(false);
            });
          }
        });
    }
  }, [isNonPipelineRun, projectUuid, requestBuild, setIsReadOnly]);

  return isReadOnly;
};
