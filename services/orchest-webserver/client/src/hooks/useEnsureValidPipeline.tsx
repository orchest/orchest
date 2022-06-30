import { useAppContext } from "@/contexts/AppContext";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
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
  pipelineUuidFromRoute: string | undefined
) => {
  const { state, dispatch } = useProjectsContext();

  const { projectUuid, pipelines, pipeline } = state;

  const validPipelineUuid = React.useMemo(() => {
    const foundPipelineUuidFromRoute = (pipelines || []).find(
      (pipeline) => pipelineUuidFromRoute === pipeline.uuid
    )?.uuid;
    return foundPipelineUuidFromRoute || pipeline?.uuid;
  }, [pipeline?.uuid, pipelineUuidFromRoute, pipelines]);

  const pipelineUuidToOpen =
    validPipelineUuid || pipelines?.find(Boolean)?.uuid;

  // Await `useAutoFetchPipelines` to refetch.
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
      pipelineUuidToOpen !== pipelineUuidFromRoute
    );
  }, [
    projectUuidFromRoute,
    projectUuid,
    pipelineUuidFromRoute,
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
      customNavigateTo(projectUuid, pipelineUuidToOpen, !validPipelineUuid);
    }
  }, [
    customNavigateTo,
    shouldRedirectPipeline,
    projectUuid,
    pipelineUuidToOpen,
    validPipelineUuid,
  ]);

  return hasValue(pipelines) && !pipelineUuidToOpen;
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
  const { setAlert } = useAppContext();

  const customNavigateTo = React.useCallback(
    (projectUuid: string, pipelineUuid: string, replace: boolean) => {
      navigateTo(location.pathname, {
        query: { projectUuid, pipelineUuid },
        replace,
      });
    },
    [location.pathname, navigateTo]
  );
  const shouldShowAlert = useEnsureValidPipelineBase(
    customNavigateTo,
    projectUuid,
    pipelineUuid
  );

  const isAtPipelineEditor = location.pathname === siteMap.pipeline.path;
  React.useEffect(() => {
    if (shouldShowAlert && !isAtPipelineEditor) {
      setAlert(
        "Note",
        "No pipeline found in this project. Create a pipeline first."
      );
      navigateTo(siteMap.pipeline.path, { query: { projectUuid } });
      return;
    }
  }, [shouldShowAlert, isAtPipelineEditor, navigateTo, setAlert, projectUuid]);
};
