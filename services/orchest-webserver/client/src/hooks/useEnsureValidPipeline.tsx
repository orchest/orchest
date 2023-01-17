import { useGlobalContext } from "@/contexts/GlobalContext";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useActiveProject } from "./useActiveProject";

// Note: this is the testable part of the hook `useEnsureValidPipeline`
// as we want to separate it from the global contexts: `useCustomRoute` and `useAppContext`.
// This hook should NOT be used alone except in jest tests.
export const useEnsureValidPipelineBase = (
  customNavigateTo: (
    projectUuid: string,
    pipelineUuid: string,
    replace: boolean
  ) => void,
  pipelineUuidFromRoute: string | undefined
) => {
  const { state, dispatch } = useProjectsContext();

  const { pipelines, pipeline } = state;
  const activeProject = useActiveProject();
  const activeProjectUuid = activeProject?.uuid;

  const validPipelineUuid = React.useMemo(() => {
    const foundPipelineUuidFromRoute = (pipelines || []).find(
      (pipeline) => pipelineUuidFromRoute === pipeline.uuid
    )?.uuid;
    return foundPipelineUuidFromRoute || pipeline?.uuid;
  }, [pipeline?.uuid, pipelines, pipelineUuidFromRoute]);

  const pipelineUuidToOpen =
    validPipelineUuid || pipelines?.find(Boolean)?.uuid;

  // Await `useAutoFetchPipelines` to refetch.
  const statesLoaded = React.useMemo(() => {
    return (
      hasValue(pipelines) &&
      hasValue(activeProjectUuid) &&
      hasValue(pipelineUuidToOpen)
    );
  }, [pipelines, activeProjectUuid, pipelineUuidToOpen]);

  const shouldRedirectPipeline = React.useMemo(() => {
    return statesLoaded && pipelineUuidFromRoute !== pipelineUuidToOpen;
  }, [pipelineUuidToOpen, statesLoaded, pipelineUuidFromRoute]);

  React.useEffect(() => {
    if (pipelineUuidToOpen && pipelineUuidToOpen !== pipeline?.uuid) {
      dispatch({
        type: "UPDATE_PIPELINE",
        payload: { uuid: pipelineUuidToOpen },
      });
    }
  }, [dispatch, pipeline?.uuid, pipelineUuidToOpen]);

  React.useEffect(() => {
    if (shouldRedirectPipeline && activeProjectUuid && pipelineUuidToOpen) {
      // Navigate to a valid pipelineUuid.
      customNavigateTo(
        activeProjectUuid,
        pipelineUuidToOpen,
        !validPipelineUuid
      );
    }
  }, [
    customNavigateTo,
    shouldRedirectPipeline,
    activeProjectUuid,
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
  const { setAlert } = useGlobalContext();

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
