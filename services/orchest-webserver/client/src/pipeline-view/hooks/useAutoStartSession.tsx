import { useGlobalContext } from "@/contexts/GlobalContext";
import {
  BUILD_IMAGE_SOLUTION_VIEW,
  useProjectsContext,
} from "@/contexts/ProjectsContext";
import { useSessionsContext } from "@/contexts/SessionsContext";
import { useActivePipeline } from "@/hooks/useActivePipeline";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useHasChanged } from "@/hooks/useHasChanged";
import { siteMap } from "@/routingConfig";
import { FetchError, hasValue } from "@orchest/lib-utils";
import React from "react";
import { usePipelineDataContext } from "../contexts/PipelineDataContext";

export const useAutoStartSession = () => {
  const {
    state: { sessions },
    getSession,
    startSession,
  } = useSessionsContext();
  const {
    state: { pipelineReadOnlyReason },
    dispatch,
  } = useProjectsContext();
  const pipeline = useActivePipeline();
  const { setAlert, setConfirm } = useGlobalContext();
  const { isInteractive } = usePipelineDataContext();
  const { pipelineUuid: pipelineUuidFromRoute, navigateTo } = useCustomRoute();

  const session = React.useMemo(() => getSession(pipeline?.uuid), [
    getSession,
    pipeline?.uuid,
  ]);

  const hasLoadedPipeline =
    hasValue(pipelineUuidFromRoute) && pipelineUuidFromRoute === pipeline?.uuid;

  const shouldShowJupyterLabWarning =
    hasLoadedPipeline &&
    pipelineReadOnlyReason === "JupyterEnvironmentBuildInProgress";

  React.useEffect(() => {
    if (shouldShowJupyterLabWarning) {
      setConfirm(
        "Notice",
        "A JupyterLab environment build is in progress. You can cancel to view the pipeline in read-only mode.",
        {
          onConfirm: () => {
            navigateTo(siteMap.configureJupyterLab.path);
            return true;
          },
          confirmLabel: "Configure JupyterLab",
        }
      );
    }
  }, [shouldShowJupyterLabWarning, setConfirm, navigateTo]);

  const shouldCheckIfAutoStartIsNeeded =
    isInteractive && // This is an interactive pipeline
    hasValue(sessions) && // `sessions` is available to look up
    hasValue(pipeline?.uuid) && // `pipeline` is loaded.
    hasLoadedPipeline && // Only auto-start the pipeline that user is viewing.
    !pipelineReadOnlyReason &&
    !hasValue(session); // `session` of the current pipeline is not yet launched.

  // The only case that auto-start should be disabled is that
  // session.status was once set as "STOPPING",
  // because this state "STOPPING" can only happen if user clicks on "Stop Session" on purpose.
  const startedPipelineUuid = React.useRef<string>();

  const environmentFinishedBuilding = useHasChanged(
    pipelineReadOnlyReason,
    (prev, curr) => hasValue(prev) && !hasValue(curr)
  );

  React.useEffect(() => {
    if (session?.status === "STOPPING")
      startedPipelineUuid.current = pipeline?.uuid;
  }, [session, pipeline?.uuid]);

  const requestStartSession = React.useCallback(
    async (pipelineUuid: string) => {
      const result = await startSession(
        pipelineUuid,
        BUILD_IMAGE_SOLUTION_VIEW.PIPELINE
      );
      if (result === true) return;
      if (result instanceof FetchError) {
        if (result.status === 409) return; // When the session already exists, you get a 409 (CONFLICT).

        const errorMessage = result.body?.message || result.message;
        const shouldUpdateReadOnlyReason =
          errorMessage === "environmentsBuildInProgress" ||
          errorMessage === "JupyterEnvironmentBuildInProgress";

        if (shouldUpdateReadOnlyReason) {
          dispatch({
            type: "SET_PIPELINE_READONLY_REASON",
            payload: errorMessage,
          });
          return;
        }
      } else {
        setAlert(
          "Error",
          `Error while starting the session: ${String(result)}`
        );
      }
    },
    [setAlert, startSession, dispatch]
  );

  React.useEffect(() => {
    if (
      pipeline?.uuid &&
      shouldCheckIfAutoStartIsNeeded &&
      (startedPipelineUuid.current !== pipeline?.uuid ||
        environmentFinishedBuilding)
    ) {
      startedPipelineUuid.current = pipeline?.uuid;
      requestStartSession(pipeline.uuid);
    }
  }, [
    shouldCheckIfAutoStartIsNeeded,
    startSession,
    pipeline?.uuid,
    requestStartSession,
    environmentFinishedBuilding,
  ]);

  /**
   * ! session related global side effect
   * TODO: should be clean-up when orchest.jupyter is refactored
   */

  React.useEffect(() => {
    if (session?.status === "STOPPING") {
      window.orchest.jupyter?.unload();
    }

    if (session?.base_url) {
      const base_url = session.base_url;

      if (base_url) {
        let baseAddress = "//" + window.location.host + base_url;
        window.orchest.jupyter?.updateJupyterInstance(baseAddress);
      }
    }
  }, [session]);

  return { session, startSession };
};
