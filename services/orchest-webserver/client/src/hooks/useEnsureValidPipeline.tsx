import { useGlobalContext } from "@/contexts/GlobalContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useActivePipeline } from "./useActivePipeline";
import { useActiveProject } from "./useActiveProject";
import { useProjectPipelines } from "./useProjectPipelines";

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
  const project = useActiveProject();
  const projectUuid = project?.uuid;
  const pipeline = useActivePipeline();
  const pipelines = useProjectPipelines(projectUuid);

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
      hasValue(projectUuid) &&
      hasValue(pipelineUuidToOpen)
    );
  }, [pipelines, projectUuid, pipelineUuidToOpen]);

  const shouldRedirectPipeline = React.useMemo(() => {
    return statesLoaded && pipelineUuidFromRoute !== pipelineUuidToOpen;
  }, [pipelineUuidToOpen, statesLoaded, pipelineUuidFromRoute]);

  React.useEffect(() => {
    if (shouldRedirectPipeline && projectUuid && pipelineUuidToOpen) {
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
