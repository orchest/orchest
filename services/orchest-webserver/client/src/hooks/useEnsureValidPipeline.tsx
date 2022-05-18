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
  projectUuid: string | undefined,
  pipelineUuid: string | undefined
) => {
  const {
    state: { pipelines, pipeline, newPipelineUuid },
    dispatch,
  } = useProjectsContext();

  const fetchedPipelines = useAutoFetchPipelines(projectUuid, pipelineUuid);

  const [lastSeenPipelineUuid, setlastSeenPipelines] = useLastSeenPipeline();

  const foundPipelineUuidFromRoute = React.useMemo(() => {
    if (!pipelines) return undefined;
    return (pipelines || []).find((pipeline) => pipelineUuid === pipeline.uuid)
      ?.uuid;
  }, [pipelines, pipelineUuid]);

  const validPipelineUuid = React.useMemo(() => {
    if (foundPipelineUuidFromRoute) return foundPipelineUuidFromRoute;

    return (pipelines || []).find(
      (pipeline) => lastSeenPipelineUuid === pipeline.uuid
    )?.uuid;
  }, [pipelines, lastSeenPipelineUuid, foundPipelineUuidFromRoute]);

  const pipelineUuidToOpen =
    validPipelineUuid || pipelines?.find(Boolean)?.uuid;

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
      !pipeline &&
      hasValue(pipelines) &&
      hasValue(projectUuid) &&
      hasValue(pipelineUuidToOpen) &&
      pipelineUuidToOpen !== pipelineUuid
    );
  }, [pipelines, projectUuid, pipelineUuid, pipelineUuidToOpen, pipeline]);

  React.useEffect(() => {
    if (shouldRedirect) {
      // Navigate to a valid pipelineUuid.
      navigateTo(siteMap.pipeline.path, {
        query: {
          projectUuid,
          pipelineUuid: pipelineUuidToOpen,
        },
        replace: !foundPipelineUuidFromRoute || !validPipelineUuid,
      });
      return;
    }
    if (validPipelineUuid) {
      dispatch({
        type: "UPDATE_PIPELINE",
        payload: { uuid: validPipelineUuid },
      });
    }
    if (validPipelineUuid && validPipelineUuid !== lastSeenPipelineUuid) {
      setlastSeenPipelines((current) => {
        if (!projectUuid || !current) return current;
        return { ...current, [projectUuid]: validPipelineUuid };
      });
    }
  }, [
    dispatch,
    projectUuid,
    setlastSeenPipelines,
    navigateTo,
    pipelineUuidToOpen,
    shouldRedirect,
    validPipelineUuid,
    lastSeenPipelineUuid,
    foundPipelineUuidFromRoute,
  ]);

  const shouldShowAlert =
    hasValue(fetchedPipelines) &&
    hasValue(pipelineUuid) &&
    fetchedPipelines?.every((p) => p.uuid !== pipelineUuid) &&
    pipelineUuid !== newPipelineUuid; // No need to show alert if pipelineUuid is a new pipeline

  return shouldShowAlert;
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
  const { navigateTo, projectUuid, pipelineUuid } = useCustomRoute();

  const shouldShowAlert = useEnsureValidPipelineBase(
    navigateTo,
    projectUuid,
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
