import { useSessionsContext } from "@/contexts/SessionsContext";
import React from "react";

// TODO: move the polling mechanism to this hook
export const useSessionsPoller = () => {
  const { dispatch } = useSessionsContext();

  React.useEffect(() => {
    dispatch({ type: "_sessionsPollingStart" });
    return () => {
      dispatch({ type: "_sessionsPollingClear" });
    };
  }, []);
};
