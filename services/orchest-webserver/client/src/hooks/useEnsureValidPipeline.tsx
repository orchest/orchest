import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { hasValue } from "@orchest/lib-utils";
import React from "react";

// Note: this is the testable part of the hook `useEnsureValidPipeline`
// as we want to separate it from the global contexts: `useCustomRoute` and `useAppContext`.
// This hook should NOT be used alone except in jest tests.
export const useEnsureValidPipelineBase = (
  customNavigateTo: (
    projectUuid: string,
    pipelineUuid: string,
    replace: boolean
  ) => void,
  projectUuidFromRoute: string | undefined,
  pipelineUuid: string | undefined
) => {
  const { state, dispatch } = useProjectsContext();

  const { projectUuid, pipelines, pipeline } = state;

  const foundPipelineUuidFromRoute = React.useMemo(() => {
    if (!pipelines) return undefined;
    return (pipelines || []).find((p) => pipelineUuid === p.uuid)?.uuid;
  }, [pipelines, pipelineUuid]);

  const validPipelineUuid = React.useMemo(() => {
    return foundPipelineUuidFromRoute || pipeline?.uuid;
  }, [foundPipelineUuidFromRoute, pipeline?.uuid]);

  const pipelineUuidToOpen =
    validPipelineUuid || pipelines?.find(Boolean)?.uuid;

  const statesLoaded = React.useMemo(() => {
    return (
      hasValue(pipelines) &&
      hasValue(projectUuid) &&
      hasValue(pipelineUuidToOpen)
    );
  }, [pipelines, projectUuid, pipelineUuidToOpen]);

  const shouldRedirectPipeline = React.useMemo(() => {
    return (
      statesLoaded &&
      projectUuidFromRoute === projectUuid && // Only redirect to pipeline when project is already redirected.
      pipelineUuidToOpen !== pipelineUuid
    );
  }, [
    projectUuidFromRoute,
    projectUuid,
    pipelineUuid,
    pipelineUuidToOpen,
    statesLoaded,
  ]);

  React.useEffect(() => {
    if (pipelineUuidToOpen && pipelineUuidToOpen !== pipeline?.uuid) {
      dispatch({
        type: "UPDATE_PIPELINE",
        payload: { uuid: pipelineUuidToOpen },
      });
    }
  }, [dispatch, pipeline?.uuid, pipelineUuidToOpen]);

  React.useEffect(() => {
    if (shouldRedirectPipeline && pipelineUuidToOpen && projectUuid) {
      // Navigate to a valid pipelineUuid.
      customNavigateTo(
        projectUuid,
        pipelineUuidToOpen,
        !foundPipelineUuidFromRoute || !validPipelineUuid
      );
    }
  }, [
    customNavigateTo,
    shouldRedirectPipeline,
    projectUuid,
    pipelineUuidToOpen,
    validPipelineUuid,
    foundPipelineUuidFromRoute,
  ]);
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
  const { location, navigateTo, projectUuid, pipelineUuid } = useCustomRoute();

  const customNavigateTo = React.useCallback(
    (projectUuid: string, pipelineUuid: string, replace: boolean) => {
      navigateTo(location.pathname, {
        query: { projectUuid, pipelineUuid },
        replace,
      });
    },
    [location.pathname, navigateTo]
  );
  useEnsureValidPipelineBase(customNavigateTo, projectUuid, pipelineUuid);
};
