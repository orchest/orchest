import { useAppContext } from "@/contexts/AppContext";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useFetchEnvironments } from "@/hooks/useFetchEnvironments";
import { useFetchPipelineJson } from "@/hooks/useFetchPipelineJson";
import { PipelineJson, StepsDict } from "@/types";
import { fetcher, uuidv4 } from "@orchest/lib-utils";
import React from "react";
import useSWR, { MutatorCallback } from "swr";
import { extractStepsFromPipelineJson } from "../common";

export const useInitializePipelineEditor = (
  pipelineUuid: string,
  projectUuid: string,
  jobUuid: string | undefined,
  runUuid: string | undefined,
  isReadOnly: boolean,
  initializeEventVars: (steps: StepsDict) => void
) => {
  const { dispatch } = useProjectsContext();
  const { setAlert } = useAppContext();

  const {
    pipelineJson,
    setPipelineJson: originalSetPipelineJson,
    isFetchingPipelineJson,
    error: fetchPipelineJsonError,
  } = useFetchPipelineJson({ pipelineUuid, projectUuid, jobUuid, runUuid });

  React.useEffect(() => {
    if (pipelineJson && !fetchPipelineJsonError) {
      dispatch({
        type: "pipelineSet",
        payload: {
          pipelineUuid,
          projectUuid,
          pipelineName: pipelineJson.name,
        },
      });
    }
  }, [
    pipelineJson,
    fetchPipelineJsonError,
    dispatch,
    pipelineUuid,
    projectUuid,
  ]);

  const hash = React.useRef<string>(uuidv4());
  const setPipelineJson = React.useCallback(
    (
      data?:
        | PipelineJson
        | Promise<PipelineJson>
        | MutatorCallback<PipelineJson>,
      flushPage?: boolean
    ) => {
      // in case you want to re-initialize all components according to the new PipelineJson
      // to be part of the re-initialization, you need to assign hash.current as part of the key of your component
      if (flushPage) hash.current = uuidv4();
      originalSetPipelineJson(data);
    },
    [originalSetPipelineJson]
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
    hash,
    error,
    isFetching: isFetchingPipelineJson || isFetchingCwd,
  };
};
