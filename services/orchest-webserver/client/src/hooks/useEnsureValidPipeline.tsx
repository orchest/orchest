import { Code } from "@/components/common/Code";
import { useAppContext } from "@/contexts/AppContext";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useAutoFetchPipelines } from "@/contexts/useAutoFetchPipelines";
import type { NavigateParams } from "@/hooks/useCustomRoute";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useLastSeenPipeline } from "./useLastSeenPipeline";

// Note: this is the testable part of the hook `useEnsureValidPipeline`
// as we want to separate it from the global contexts: `useCustomRoute` and `useAppContext`.
// This hook should NOT be used alone except in jest tests.
export const useEnsureValidPipelineBase = (
  navigateTo: (
    path: string,
    params?: NavigateParams | undefined,
    e?: React.MouseEvent<Element, MouseEvent> | undefined
  ) => void,
  projectUuidFromRoute: string | undefined,
  pipelineUuid: string | undefined
) => {
  const {
    state: { pipelines, pipeline, hasLoadedPipelinesInPipelineEditor },
    dispatch,
  } = useProjectsContext();

  React.useEffect(() => {
    // When user switching pipelines, state.pipeline is already loaded.
    // In order to force loading with the new pipeline_uuid, unset state.pipeline
    // when useEnsureValidPipelineBase is just mounted.
    dispatch({ type: "UNSET_PIPELINE" });
  }, [dispatch]);

  useAutoFetchPipelines();

  const [lastSeenPipeline, setlastSeenPipelineString] = useLastSeenPipeline();

  const isTryingToFindByUuid = hasValue(pipelines) && hasValue(pipelineUuid);

  const foundPipelineByRouteUuid = React.useMemo(
    () =>
      isTryingToFindByUuid
        ? pipelines.find((pipeline) => pipeline.uuid === pipelineUuid)
        : undefined,
    [isTryingToFindByUuid, pipelineUuid, pipelines]
  );

  const pipelineToOpen = React.useMemo(() => {
    return (
      foundPipelineByRouteUuid || lastSeenPipeline || pipelines?.find(Boolean)
    );
  }, [foundPipelineByRouteUuid, lastSeenPipeline, pipelines]);

  React.useEffect(() => {
    /**
     * Redirect only when pipeline is not yet loaded:
     * - app is just loaded
     * - switching project in pipeline editor
     * - enter from non-project to project-related views, e.g. settings -> pipeline
     */
    const shouldRedirect =
      pipelineToOpen && pipelineToOpen?.uuid !== pipelineUuid && !pipeline;

    if (shouldRedirect) {
      // Navigate to a valid pipelineUuid.
      navigateTo(siteMap.pipeline.path, {
        query: {
          projectUuid: projectUuidFromRoute,
          pipelineUuid: pipelineToOpen.uuid,
        },
      });
    }
    // Has pipelineUuid and no longer need to redirect, meaning that `pipelineUuid` is valid.
    const hasValidPipelineUuid = !shouldRedirect && pipelineUuid;
    // pipelineUuid is valid, but not yet propogated to external state.
    const shouldPersistPipelineUUid =
      hasValidPipelineUuid && pipeline?.uuid !== pipelineUuid;
    if (shouldPersistPipelineUUid) {
      dispatch({
        type: "UPDATE_PIPELINE",
        payload: { uuid: pipelineUuid },
      });
      setlastSeenPipelineString(`${projectUuidFromRoute}:${pipelineUuid}`);
    }
  }, [
    dispatch,
    pipelineUuid,
    projectUuidFromRoute,
    setlastSeenPipelineString,
    navigateTo,
    pipeline,
    pipelineToOpen,
  ]);

  return (
    !hasLoadedPipelinesInPipelineEditor &&
    isTryingToFindByUuid &&
    !foundPipelineByRouteUuid
  );
};

/**
 * `useEnsureValidPipeline` ensures that `pipeline` in ProjectsContext is a valid one.
 * If the given `pipeline_uuid` in the route is not valid, it will show an alert and navigate to the
 * first pipeline in the project.
 *
 * This hook should be used in the views that user could provide `pipeline_uuid`, such as
 * `PipelineEditor`, `PipelineSettingsView`, `LogsView`, and `JupyterLabView`.
 */
export const useEnsureValidPipeline = () => {
  const { setAlert } = useAppContext();
  const {
    navigateTo,
    projectUuid: projectUuidFromRoute,
    pipelineUuid,
  } = useCustomRoute();

  const shouldShowAlert = useEnsureValidPipelineBase(
    navigateTo,
    projectUuidFromRoute,
    pipelineUuid
  );

  React.useEffect(() => {
    if (shouldShowAlert) {
      setAlert(
        "Pipeline not found",
        <Stack direction="column" spacing={2}>
          <Box>
            {`Couldn't find pipeline `}
            <Code>{pipelineUuid}</Code>
            {` . The pipeline might have been deleted, or you might have had a wrong URL.`}
          </Box>
          <Box>Will try to load another pipeline in this project.</Box>
        </Stack>
      );
    }
  }, [pipelineUuid, setAlert, shouldShowAlert]);
};
