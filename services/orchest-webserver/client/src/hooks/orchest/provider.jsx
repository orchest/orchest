// @ts-check
import React from "react";
import { uuidv4 } from "@orchest/lib-utils";
import { OrchestContext } from "./context";
import { OrchestSessionsProvider } from "./sessions";
import { isSession, isCurrentSession } from "./utils";
import { useLocalStorage } from "../local-storage";

/**
 * @typedef {import("@/types").TOrchestAction} TOrchestAction
 * @typedef {import("@/types").IOrchestGet} IOrchestGet
 * @typedef {import("@/types").IOrchestSessionUuid} IOrchestSessionUuid
 * @typedef {import("@/types").IOrchestSession} IOrchestSession
 * @typedef {import("@/types").IOrchestState} IOrchestState
 * @typedef {import("@/types").IOrchestContext} IOrchestContext
 */

/**
 * @param {IOrchestState} state
 * @param {TOrchestAction} action
 * @returns
 */
const reducer = (state, action) => {
  switch (action.type) {
    case "alert":
      return { ...state, alert: action.payload };
    case "isLoaded":
      return { ...state, isLoading: false };
    case "drawerToggle":
      return { ...state, drawerIsOpen: !state.drawerIsOpen };
    case "pipelineClear":
      return {
        ...state,
        pipeline_uuid: undefined,
        pipelineName: undefined,
      };
    case "pipelineSet":
      return { ...state, pipelineFetchHash: uuidv4(), ...action.payload };
    case "pipelineSetSaveStatus":
      return { ...state, pipelineSaveStatus: action.payload };
    case "pipelineUpdateReadOnlyState":
      return { ...state, pipelineIsReadOnly: action.payload };
    case "projectSet":
      return { ...state, project_uuid: action.payload };
    case "sessionToggle":
      return { ...state, _sessionsToggle: action.payload };
    case "_sessionsToggleClear":
      return { ...state, _sessionToggle: null };
    case "_sessionsSet":
      return { ...state, ...action.payload };
    case "_sessionsPollingStart":
      return { ...state, _sessionsIsPolling: true };
    case "_sessionsPollingClear":
      return { ...state, _sessionsIsPolling: false };
    case "sessionsKillAll":
      return { ...state, sessionsKillAllInProgress: true };
    case "_sessionsKillAllClear":
      return { ...state, sessionsKillAllInProgress: false };
    case "setView":
      return { ...state, view: action.payload };
    case "clearView":
      return { ...state, view: null };
    default:
      console.log(action);
      throw new Error();
  }
};

const initialState = {
  isLoading: true,
  pipelineFetchHash: null,
  pipelineName: null,
  pipelineIsReadOnly: false,
  pipelineSaveStatus: "saved",
  pipeline_uuid: undefined,
  project_uuid: undefined,
  sessions: [],
  sessionsIsLoading: true,
  sessionsKillAllInProgress: false,
  view: "pipeline",
  _sessionsToFetch: [],
  _sessionsToggle: null,
};

export const OrchestProvider = ({ config, user_config, children }) => {
  const orchest = window.orchest;

  const [drawerIsOpen, setDrawerIsOpen] = useLocalStorage("drawer", true);
  const [project_uuid, setProject_uuid] = useLocalStorage(
    "selected_project_uuid",
    undefined
  );

  /** @type {[IOrchestState, React.Dispatch<TOrchestAction>]} */
  const [state, dispatch] = React.useReducer(reducer, {
    ...initialState,
    drawerIsOpen,
    project_uuid,
    config,
    user_config,
  });

  /** @type {IOrchestGet} */
  const get = {
    session: (session) =>
      state?.sessions?.find((stateSession) => isSession(session, stateSession)),
    currentSession: state?.sessions?.find((session) =>
      isCurrentSession(session, state)
    ),
  };

  /**
   * Side Effects
   * ========================================= */

  /**
   * Complete loading once config has been provided and local storage values
   * have been achieved
   */
  React.useEffect(() => {
    if (config && user_config) {
      dispatch({ type: "isLoaded" });
    }
  }, [config, user_config]);

  /**
   * Sync Local Storage
   */
  React.useEffect(() => {
    setDrawerIsOpen(state?.drawerIsOpen);
  }, [state.drawerIsOpen]);
  React.useEffect(() => {
    setProject_uuid(state?.project_uuid);
  }, [state.project_uuid]);

  /**
   * Handle Alerts
   */
  React.useEffect(() => {
    if (state.alert) {
      orchest.alert(...state.alert);
    }
  }, [state.alert]);

  if (process.env.NODE_ENV === "development")
    console.log("(Dev Mode) useOrchest: state updated", state);

  return (
    <OrchestContext.Provider
      value={{
        state,
        dispatch,
        get,
      }}
    >
      <OrchestSessionsProvider>{children}</OrchestSessionsProvider>
    </OrchestContext.Provider>
  );
};
