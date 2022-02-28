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

  const [shouldAutoStart, setShouldAutoStart] = React.useState(false);

  const hasNoSession = !sessionsIsLoading && !session;
  const toggleSessionPayload = React.useMemo(() => {
    return { pipelineUuid, projectUuid };
  }, [pipelineUuid, projectUuid]);

  // check if auto-start should be enabled when mounted
  // auto-start should only happen one time, since mounted
  // because if user manually kill the session, auto-start shouldn't be triggered
  React.useEffect(() => {
    if (hasNoSession) setShouldAutoStart(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (
      toggleSessionPayload &&
      isReadOnly !== true &&
      hasNoSession &&
      shouldAutoStart
    ) {
      setShouldAutoStart(false);
      toggleSession(toggleSessionPayload);
    }
  }, [
    hasNoSession,
    isReadOnly,
    toggleSessionPayload,
    toggleSession,
    shouldAutoStart,
  ]);

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
