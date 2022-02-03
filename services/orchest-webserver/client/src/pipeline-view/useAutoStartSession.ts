import { useSessionsContext } from "@/contexts/SessionsContext";
import React from "react";

export const useAutoStartSession = ({
  projectUuid,
  pipelineUuid,
  isReadOnly = false,
}: {
  projectUuid: string;
  pipelineUuid: string;
  isReadOnly: boolean;
}) => {
  const {
    state: { sessionsIsLoading },
    getSession,
    toggleSession,
  } = useSessionsContext();

  const session = React.useMemo(
    () => getSession({ projectUuid, pipelineUuid }),
    [projectUuid, pipelineUuid, getSession]
  );

  // in case that user manually kill the session
  // we only do auto start only when user mount the component
  const hasAutoStarted = React.useRef(false);

  const hasNoSession = !sessionsIsLoading && !session;
  const toggleSessionPayload = React.useMemo(() => {
    return { pipelineUuid, projectUuid };
  }, [pipelineUuid, projectUuid]);

  React.useEffect(() => {
    if (
      toggleSessionPayload &&
      isReadOnly !== true &&
      hasNoSession &&
      !hasAutoStarted.current
    ) {
      hasAutoStarted.current = true;
      toggleSession(toggleSessionPayload);
    }
  }, [hasNoSession, isReadOnly, toggleSessionPayload, toggleSession]);

  /**
   * ! session related global side effect
   * TODO: should be clean-up when orchest.jupyter is refactored
   */

  React.useEffect(() => {
    if (session?.status === "STOPPING") {
      window.orchest.jupyter.unload();
    }

    if (session?.notebook_server_info) {
      const base_url = session?.notebook_server_info?.base_url;

      if (base_url) {
        let baseAddress = "//" + window.location.host + base_url;
        window.orchest.jupyter.updateJupyterInstance(baseAddress);
      }
    }
  }, [session]);

  return session;
};
