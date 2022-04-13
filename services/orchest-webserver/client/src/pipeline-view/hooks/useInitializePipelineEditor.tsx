import { Code } from "@/components/common/Code";
import { useAppContext } from "@/contexts/AppContext";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useFetchEnvironments } from "@/hooks/useFetchEnvironments";
import { useFetchPipelineJson } from "@/hooks/useFetchPipelineJson";
import { siteMap } from "@/Routes";
import { PipelineJson, StepsDict } from "@/types";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import { uuidv4 } from "@orchest/lib-utils";
import React from "react";
import { MutatorCallback } from "swr";
import { extractStepsFromPipelineJson } from "../common";

export const useInitializePipelineEditor = (
  runUuid: string | undefined,
  isReadOnly: boolean,
  initializeEventVars: (steps: StepsDict) => void
) => {
  const {
    state: { pipelines, pipeline, projectUuid },
    dispatch,
  } = useProjectsContext();
  const { setAlert } = useAppContext();
  const {
    navigateTo,
    projectUuid: projectUuidFromRoute,
    pipelineUuid,
    jobUuid,
  } = useCustomRoute();

  React.useEffect(() => {
    const isTryingToFindByUuid = pipelines && pipelineUuid;
    const foundPipelineByUuid = isTryingToFindByUuid
      ? pipelines.find((pipeline) => pipeline.uuid === pipelineUuid)
      : undefined;

    if (isTryingToFindByUuid && !foundPipelineByUuid) {
      setAlert(
        "Pipeline not found",
        <Stack direction="column" spacing={2}>
          <Box>
            {`Pipeline with the given uuid `}
            <Code>{pipelineUuid}</Code>
            {` is not found. You might have had a wrong URL, or this pipeline might have been deleted.`}
          </Box>
          <Box>Will try to load other pipelines in this project.</Box>
        </Stack>
      );
    }

    const pipelineToOpen = foundPipelineByUuid || pipelines?.find(Boolean);

    if (pipelineToOpen && pipelineToOpen?.uuid !== pipelineUuid) {
      // Navigate to a valid pipelineUuid.
      navigateTo(siteMap.pipeline.path, {
        query: {
          projectUuid: projectUuidFromRoute,
          pipelineUuid: pipelineToOpen.uuid,
        },
      });
      return;
    }

    // Reaching this point, `pipelineUuid` must be valid.
    // We can safely update `state.pipeline`.
    if (pipeline?.uuid !== pipelineUuid) {
      dispatch({
        type: "UPDATE_PIPELINE",
        payload: { uuid: pipelineUuid },
      });
    }
  }, [
    dispatch,
    setAlert,
    pipeline?.uuid,
    pipelineUuid,
    pipelines,
    navigateTo,
    projectUuidFromRoute,
  ]);

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
