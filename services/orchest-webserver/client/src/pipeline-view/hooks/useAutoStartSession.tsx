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

  const toggleSessionPayload = React.useMemo(() => {
    return { pipelineUuid, projectUuid };
  }, [pipelineUuid, projectUuid]);

  const hasFired = React.useRef(false);
  React.useEffect(() => {
    // session already alive from beginning
    if (!sessionsIsLoading && session) {
      hasFired.current = true;
    }

    if (
      !hasFired.current &&
      isReadOnly !== true &&
      !sessionsIsLoading &&
      !session
    ) {
      hasFired.current = true;
      setShouldAutoStart(true);
    }
  }, [sessionsIsLoading, session, isReadOnly, setShouldAutoStart, hasFired]);

  React.useEffect(() => {
    if (toggleSessionPayload && shouldAutoStart) {
      setShouldAutoStart(false);
      toggleSession(toggleSessionPayload);
    }
  }, [toggleSessionPayload, toggleSession, shouldAutoStart]);

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
