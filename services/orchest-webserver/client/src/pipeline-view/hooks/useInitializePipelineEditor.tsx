import { useAppContext } from "@/contexts/AppContext";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useFetchEnvironments } from "@/hooks/useFetchEnvironments";
import { useFetchPipelineJson } from "@/hooks/useFetchPipelineJson";
import { siteMap } from "@/Routes";
import { PipelineJson, StepsDict } from "@/types";
import { uuidv4 } from "@orchest/lib-utils";
import React from "react";
import { MutatorCallback } from "swr";
import { extractStepsFromPipelineJson } from "../common";

export const useInitializePipelineEditor = (
  pipelineUuid: string | undefined,
  projectUuid: string,
  jobUuid: string | undefined,
  runUuid: string | undefined,
  isReadOnly: boolean,
  initializeEventVars: (steps: StepsDict) => void
) => {
  const {
    state: { pipelines },
    dispatch,
  } = useProjectsContext();
  const { setAlert } = useAppContext();
  const { navigateTo } = useCustomRoute();

  const pipeline = React.useMemo(() => {
    return (
      pipelines.find((pipeline) => pipeline.uuid === pipelineUuid) ||
      pipelines[0]
    );
  }, [pipelines, pipelineUuid]);

  React.useEffect(() => {
    if ((!pipelineUuid && pipeline?.uuid) || pipelineUuid !== pipeline?.uuid) {
      navigateTo(siteMap.pipeline.path, {
        query: { projectUuid, pipelineUuid: pipeline?.uuid },
      });
      return;
    }
    dispatch({
      type: "UPDATE_PIPELINE",
      payload: { uuid: pipeline?.uuid },
    });
  }, [dispatch, pipeline?.uuid, projectUuid, pipelineUuid, navigateTo]);

  const {
    pipelineJson,
    setPipelineJson: originalSetPipelineJson,
    isFetchingPipelineJson,
    error,
  } = useFetchPipelineJson({
    pipelineUuid: pipeline?.uuid,
    projectUuid,
    jobUuid,
    runUuid,
  });

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

  const pipelineCwd = pipeline?.path.replace(/\/?[^\/]*.orchest$/, "/");

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
    isFetching: isFetchingPipelineJson,
  };
};
