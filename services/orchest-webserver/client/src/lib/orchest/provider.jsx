// @ts-check
import React from "react";
import { OrchestContext } from "./context";
import { initialState, reducer, isSession, isCurrentSession } from "./reducer";
import { OrchestSideEffects } from "./side-effects";
import { useSessions } from "./api/sessions";
import useSWR from "swr";
import { fetcher } from "../fetcher";

/**
 * @typedef {import("@/types").TOrchestAction} TOrchestAction
 * @typedef {import("@/types").IOrchestGet} IOrchestGet
 * @typedef {import("@/types").IOrchestState} IOrchestState
 */

export const OrchestProvider = ({ config, user_config, children }) => {
  /** @type {[IOrchestState, React.Dispatch<TOrchestAction>]} */
  const [state, dispatch] = React.useReducer(reducer, initialState);

  const { sessions } = useSessions(state);

  /** @type {IOrchestGet} */
  const get = {
    session: (session) =>
      sessions?.find((stateSession) => isSession(session, stateSession)),
    currentSession: sessions?.find((session) =>
      isCurrentSession(session, state)
    ),
  };

  /**
   * Loading
   */
  React.useEffect(() => {
    if (config && user_config) {
      dispatch({ type: "isLoaded" });
    }
  }, [config, user_config]);

  return (
    <OrchestContext.Provider
      value={{
        state,
        dispatch,
        get,
      }}
    >
      <OrchestSideEffects>{children}</OrchestSideEffects>
    </OrchestContext.Provider>
  );
};
