import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useSessionsContext } from "@/contexts/SessionsContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { hasValue } from "@orchest/lib-utils";
import React from "react";

export const useAutoStartSession = ({
  isReadOnly = false,
}: {
  isReadOnly: boolean;
}) => {
  const {
    state: { sessions },
    getSession,
    toggleSession,
  } = useSessionsContext();
  const {
    state: { projectUuid, pipeline },
  } = useProjectsContext();
  const { pipelineUuid: pipelineUuidFromRoute } = useCustomRoute();

  const session = React.useMemo(
    () => getSession({ projectUuid, pipelineUuid: pipeline?.uuid }),
    [projectUuid, pipeline?.uuid, getSession]
  );

  const toggleSessionPayload = React.useMemo(() => {
    if (!pipeline?.uuid || !projectUuid) return null;
    return { pipelineUuid: pipeline?.uuid, projectUuid };
  }, [pipeline?.uuid, projectUuid]);

  const shouldCheckIfAutoStartIsNeeded =
    hasValue(toggleSessionPayload) &&
    !isReadOnly &&
    hasValue(sessions) && // `sessions` is available to look up
    session?.pipelineUuid !== pipeline?.uuid && // when user is switching pipelines
    pipelineUuidFromRoute === pipeline?.uuid; // Only auto-start the pipeline that user is viewing.

  const isAutoStartAllowed = React.useRef(false);

  React.useEffect(() => {
    // useHasChanged is not applicable here.
    // `shouldCheckIfAutoStartIsNeeded` might not be true in the same render when pipeline?.uuid is changed
    // if user is stopping the session, do not auto-start it.
    if (pipeline?.uuid && session?.status !== "STOPPING")
      isAutoStartAllowed.current = true;
  }, [pipeline?.uuid]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (shouldCheckIfAutoStartIsNeeded && isAutoStartAllowed.current) {
      isAutoStartAllowed.current = false;
      toggleSession(toggleSessionPayload, true);
    }
  }, [
    toggleSessionPayload,
    shouldCheckIfAutoStartIsNeeded,
    isAutoStartAllowed,
    toggleSession,
  ]);

  /**
   * ! session related global side effect
   * TODO: should be clean-up when orchest.jupyter is refactored
   */

  React.useEffect(() => {
    if (session?.status === "STOPPING") {
      window.orchest.jupyter.unload();
    }

    if (session?.base_url) {
      const base_url = session.base_url;

      if (base_url) {
        let baseAddress = "//" + window.location.host + base_url;
        window.orchest.jupyter.updateJupyterInstance(baseAddress);
      }
    }
  }, [session]);

  return session;
};
