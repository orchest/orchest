import { useAppContext } from "@/contexts/AppContext";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useFetchEnvironments } from "@/hooks/useFetchEnvironments";
import { PipelineJson, StepsDict } from "@/types";
import { getPipelineJSONEndpoint } from "@/utils/webserver-utils";
import { fetcher } from "@orchest/lib-utils";
import React from "react";
import useSWR, { MutatorCallback } from "swr";
import { extractStepsFromPipelineJson } from "./common";

export const useInitializePipelineEditor = (
  pipelineUuid: string,
  projectUuid: string,
  jobUuid: string,
  runUuid: string | undefined,
  isReadOnly: boolean,
  initializeEventVars: (steps: StepsDict) => void
) => {
  const { dispatch } = useProjectsContext();
  const { setAlert } = useAppContext();

  const {
    data: pipelineJson,
    mutate,
    error: fetchPipelineJsonError,
    isValidating: isFetchingPipelineJson,
  } = useSWR(
    projectUuid && pipelineUuid
      ? getPipelineJSONEndpoint(pipelineUuid, projectUuid, jobUuid, runUuid)
      : null,
    (url) =>
      fetcher<{ success: boolean; pipeline_json: string }>(url).then(
        (result) => {
          if (!result.success) {
            throw { message: "Unable to load pipeline" };
            return;
          }

          const fetchedPipelineJson: PipelineJson = JSON.parse(
            result.pipeline_json
          );
          dispatch({
            type: "pipelineSet",
            payload: {
              pipelineUuid,
              projectUuid,
              pipelineName: fetchedPipelineJson.name,
            },
          });
          return fetchedPipelineJson;
        }
      )
  );

  const setPipelineJson = React.useCallback(
    (
      data?:
        | PipelineJson
        | Promise<PipelineJson>
        | MutatorCallback<PipelineJson>
    ) => mutate(data, false),
    [mutate]
  );

  const {
    data: pipelineCwd,
    error: fetchCwdError,
    isValidating: isFetchingCwd,
  } = useSWR(
    !isReadOnly && projectUuid && pipelineUuid
      ? `/async/file-picker-tree/pipeline-cwd/${projectUuid}/${pipelineUuid}`
      : null,
    (url) =>
      fetcher<{ cwd: string }>(url).then(
        (cwdPromiseResult) => `${cwdPromiseResult.cwd}/`
      )
  );

  const error = fetchPipelineJsonError || fetchCwdError;

  React.useEffect(() => {
    if (error) {
      setAlert("Error", `Failed to initialize pipeline. ${error.message}`);
    }
  }, [error, setAlert]);

  // initialize eventVars.steps
  const initialized = React.useRef(false);
  React.useEffect(() => {
    if (!isFetchingPipelineJson && pipelineJson && !initialized.current) {
      initialized.current = true;

      let newSteps = extractStepsFromPipelineJson(pipelineJson);
      initializeEventVars(newSteps);
    }
  }, [isFetchingPipelineJson, pipelineJson, initializeEventVars]);

  const { data: environments = [] } = useFetchEnvironments(
    !isReadOnly ? projectUuid : undefined
  );

  return {
    pipelineCwd,
    pipelineJson,
    environments,
    setPipelineJson,
    error,
    isFetching: isFetchingPipelineJson || isFetchingCwd,
  };
};
