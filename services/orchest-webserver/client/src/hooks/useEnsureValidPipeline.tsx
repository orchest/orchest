import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useAutoFetchPipelines } from "@/contexts/useAutoFetchPipelines";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useLastSeenPipeline } from "./useLastSeenPipeline";

// Note: this is the testable part of the hook `useEnsureValidPipeline`
// as we want to separate it from the global contexts: `useCustomRoute` and `useAppContext`.
// This hook should NOT be used alone except in jest tests.
export const useEnsureValidPipelineBase = (
  navigateToPipeline: (pipelineUuid: string, replace: boolean) => void,
  pipelineUuid: string | undefined
) => {
  const { state, dispatch } = useProjectsContext();

  const { pipelines, pipeline, newPipelineUuid, projectUuid } = state;

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
      hasValue(pipelines) &&
      hasValue(projectUuid) &&
      hasValue(pipelineUuidToOpen) &&
      (pipelineUuidToOpen !== pipelineUuid || !pipelineUuid)
    );
  }, [pipelines, projectUuid, pipelineUuid, pipelineUuidToOpen]);

  const hasRedirected = React.useRef(false);
  React.useEffect(() => {
    if (pipelineUuidToOpen && pipelineUuidToOpen !== pipeline?.uuid) {
      dispatch({
        type: "UPDATE_PIPELINE",
        payload: { uuid: pipelineUuidToOpen },
      });
    }
    if (pipelineUuidToOpen && pipelineUuidToOpen !== lastSeenPipelineUuid) {
      setlastSeenPipelines((current) => {
        if (!projectUuid || !current) return current;
        return { ...current, [projectUuid]: pipelineUuidToOpen };
      });
    }

    if (shouldRedirect && pipelineUuidToOpen && !hasRedirected.current) {
      // Navigate to a valid pipelineUuid.
      hasRedirected.current = true;
      navigateToPipeline(
        pipelineUuidToOpen,
        !foundPipelineUuidFromRoute || !validPipelineUuid
      );
    }
  }, [
    dispatch,
    projectUuid,
    pipeline?.uuid,
    setlastSeenPipelines,
    navigateToPipeline,
    pipelineUuidToOpen,
    shouldRedirect,
    validPipelineUuid,
    lastSeenPipelineUuid,
    foundPipelineUuidFromRoute,
  ]);

  // Note that `fetchedPipelines` is used here instead of `state.pipelines`.
  // In order to determine if the given pipeline UUID is valid,
  // it is only possible to check pipelineUuid and the response before redirect happens.
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
  const { navigateTo, projectUuid, pipelineUuid } = useCustomRoute();

  const navigateToPipeline = React.useCallback(
    (pipelineUuid: string, replace: boolean) => {
      navigateTo(siteMap.pipeline.path, {
        query: { projectUuid, pipelineUuid },
        replace,
      });
    },
    [projectUuid, navigateTo]
  );
  useEnsureValidPipelineBase(navigateToPipeline, pipelineUuid);
};
