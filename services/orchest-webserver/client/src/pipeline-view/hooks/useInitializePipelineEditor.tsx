import { useAppContext } from "@/contexts/AppContext";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useEnsureValidPipeline } from "@/hooks/useEnsureValidPipeline";
import { useFetchEnvironments } from "@/hooks/useFetchEnvironments";
import { useFetchPipelineJson } from "@/hooks/useFetchPipelineJson";
import { siteMap } from "@/routingConfig";
import { PipelineJson, StepsDict } from "@/types";
import { uuidv4 } from "@orchest/lib-utils";
import React from "react";
import { extractStepsFromPipelineJson } from "../common";

export const useInitializePipelineEditor = (
  runUuid: string | undefined,
  isReadOnly: boolean,
  initializeEventVars: (steps: StepsDict) => void
) => {
  const {
    state: { pipeline, projectUuid },
  } = useProjectsContext();
  const { setAlert } = useAppContext();
  const {
    navigateTo,
    projectUuid: projectUuidFromRoute,
    pipelineUuid: pipelineuuidFromRoute,
    jobUuid,
  } = useCustomRoute();

  useEnsureValidPipeline();

  const {
    pipelineJson,
    setPipelineJson: originalSetPipelineJson,
    isFetchingPipelineJson,
    error,
  } = useFetchPipelineJson({
    // This `projectUuid` cannot be from route. It has to be from ProjectsContext, aligned with `pipeline?.uuid`.
    // Otherwise, when user switch to another project, pipeline?.uuid does not exist.
    projectUuid,
    pipelineUuid: pipeline?.uuid,
    jobUuid,
    runUuid,
  });

  const hash = React.useRef<string>(uuidv4());
  const setPipelineJson = React.useCallback(
    (
      data?:
        | PipelineJson
        | ((currentValue: PipelineJson | undefined) => PipelineJson | undefined)
        | undefined,
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
      setAlert(
        "Error",
        `Failed to initialize pipeline. ${error.message}`,
        (resolve) => {
          navigateTo(siteMap.pipeline.path, {
            query: { projectUuid: projectUuidFromRoute },
          });
          resolve(true);
          return true;
        }
      );
    }
  }, [error, setAlert, pipeline, navigateTo, projectUuidFromRoute]);

  const initialized = React.useRef(false);

  // Only start to initialize if the uuid in pipelineJson is correct.
  // Because pipelineJson will be cached by SWR, initialization should only starts when uuid matches.
  const shouldInitialize =
    !isFetchingPipelineJson &&
    pipelineuuidFromRoute &&
    pipelineuuidFromRoute === pipelineJson?.uuid;

  // initialize eventVars.steps
  React.useEffect(() => {
    if (shouldInitialize && !initialized.current) {
      initialized.current = true;
      let newSteps = extractStepsFromPipelineJson(pipelineJson);
      initializeEventVars(newSteps);
    }
  }, [shouldInitialize, pipelineJson, initializeEventVars]);

  const { environments = [] } = useFetchEnvironments(
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
