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

  useAutoFetchPipelines();

  const isTryingToFindByUuid = hasValue(pipelines) && hasValue(pipelineUuid);
  const foundPipelineByUuid = React.useMemo(
    () =>
      isTryingToFindByUuid
        ? pipelines.find((pipeline) => pipeline.uuid === pipelineUuid)
        : undefined,
    [isTryingToFindByUuid, pipelineUuid, pipelines]
  );

  React.useEffect(() => {
    // This check should only happens if user enter the URL by hand.
    // Otherwise, this alert will appear when changing projects.

    if (pipelines) {
      dispatch({ type: "SET_HAS_LOADED_PIPELINES", payload: true });
    }
  }, [pipelines, dispatch]);

  React.useEffect(() => {
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
    if (pipelineUuid && pipeline?.uuid !== pipelineUuid) {
      dispatch({
        type: "UPDATE_PIPELINE",
        payload: { uuid: pipelineUuid },
      });
    }
  }, [
    dispatch,
    foundPipelineByUuid,
    pipeline?.uuid,
    pipelineUuid,
    pipelines,
    navigateTo,
    projectUuidFromRoute,
  ]);

  return (
    !hasLoadedPipelinesInPipelineEditor &&
    isTryingToFindByUuid &&
    !foundPipelineByUuid
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
    // This check should only happens if user enter the URL by hand.
    // Otherwise, this alert will appear when changing projects.
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
