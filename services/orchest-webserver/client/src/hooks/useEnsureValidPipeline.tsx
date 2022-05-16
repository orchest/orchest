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
  pipelineUuid: string | undefined
) => {
  const {
    state: {
      pipelines,
      projectUuid,
      pipeline,
      hasLoadedPipelinesInPipelineEditor,
    },
    dispatch,
  } = useProjectsContext();

  React.useEffect(() => {
    // When user switching pipelines, state.pipeline is already loaded.
    // In order to force loading with the new pipeline_uuid, unset state.pipeline
    // when useEnsureValidPipelineBase is just mounted.
    dispatch({ type: "UNSET_PIPELINE" });
  }, [dispatch]);

  useAutoFetchPipelines();

  const [lastSeenPipelineUuid, setlastSeenPipelines] = useLastSeenPipeline();

  const isTryingToFindByUuid = hasValue(pipelines) && hasValue(pipelineUuid);

  const foundPipelineByRouteUuid = React.useMemo(() => {
    const found = isTryingToFindByUuid
      ? pipelines.find((pipeline) => pipeline.uuid === pipelineUuid)
      : undefined;
    return found?.uuid;
  }, [isTryingToFindByUuid, pipelineUuid, pipelines]);

  const pipelineUuidToOpen = React.useMemo(() => {
    return (
      foundPipelineByRouteUuid ||
      lastSeenPipelineUuid ||
      pipelines?.find(Boolean)?.uuid
    );
  }, [foundPipelineByRouteUuid, lastSeenPipelineUuid, pipelines]);

  /**
   * Redirect only when
   * - state.pipeline is not yet loaded.
   * - pipelineUuid is invalid (undefined or is different from pipelineUuidToOpen)
   * And the above conditions are met usually when
   * - switching projects (because pipelineUuid is undefined)
   * - enter from non-project to project-related views, e.g. settings -> pipeline, because pipelineUuid is undefined.
   * - the current pipeline is deleted, then the given pipelineUuid doesn't exist anymore
   */
  const shouldRedirect = React.useMemo(() => {
    return (
      hasValue(projectUuid) &&
      hasValue(pipelineUuidToOpen) &&
      pipelineUuidToOpen !== pipelineUuid &&
      !pipeline
    );
  }, [pipeline, projectUuid, pipelineUuid, pipelineUuidToOpen]);

  const shouldPersistPipelineUUid = React.useMemo(() => {
    // Has pipelineUuid and no longer need to redirect, meaning that `pipelineUuid` is valid.
    // pipelineUuid is valid, but not yet propogated to external state.
    return (
      !shouldRedirect &&
      hasValue(pipelines) &&
      hasValue(pipelineUuid) &&
      pipeline?.uuid !== pipelineUuid
    );
  }, [shouldRedirect, pipeline, pipelineUuid, pipelines]);

  React.useEffect(() => {
    if (shouldRedirect) {
      // Navigate to a valid pipelineUuid.
      navigateTo(siteMap.pipeline.path, {
        query: {
          projectUuid: projectUuid,
          pipelineUuid: pipelineUuidToOpen,
        },
      });
      return;
    }
    if (shouldPersistPipelineUUid && pipelineUuid) {
      dispatch({
        type: "UPDATE_PIPELINE",
        payload: { uuid: pipelineUuid },
      });
      setlastSeenPipelines((current) => {
        if (!projectUuid || !current) return current;
        return { ...current, [projectUuid]: pipelineUuid };
      });
    }
  }, [
    dispatch,
    pipelineUuid,
    projectUuid,
    setlastSeenPipelines,
    navigateTo,
    pipelineUuidToOpen,
    shouldRedirect,
    shouldPersistPipelineUUid,
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
  const { navigateTo, pipelineUuid } = useCustomRoute();

  const shouldShowAlert = useEnsureValidPipelineBase(navigateTo, pipelineUuid);

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
