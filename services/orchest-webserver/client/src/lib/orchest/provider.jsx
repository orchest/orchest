// @ts-check
import React from "react";
import { uuidv4 } from "@orchest/lib-utils";
import { OrchestContext } from "./context";
import { SessionsProvider } from "./sessions";
import { isSession, isCurrentSession } from "./utils";

/**
 * @typedef {import("@/types").TOrchestAction} TOrchestAction
 * @typedef {import("@/types").IOrchestGet} IOrchestGet
 * @typedef {import("@/types").IOrchestSessionUuid} IOrchestSessionUuid
 * @typedef {import("@/types").IOrchestSession} IOrchestSession
 * @typedef {import("@/types").IOrchestState} IOrchestState
 * @typedef {import("@/types").IOrchestContext} IOrchestContext
 */

/**
 * @type {IOrchestState}
 */
const initialState = {
  isLoading: true,
  // @TODO ADD BROWSERCONFIG CHECK (from App.jsx)
  drawerIsOpen: true,
  pipelineFetchHash: null,
  pipelineName: null,
  pipelineIsReadOnly: false,
  pipelineSaveStatus: "saved",
  pipeline_uuid: undefined,
  project_uuid: undefined,
  sessions: [],
  viewCurrent: "pipeline",
  _useSessionsUuids: [],
  _useSessionsToggle: null,
};

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
      console.log(state);
      // @TODO HANDLE BROSWERCONFIG CHECK
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
    case "sessionFetch":
      return {
        ...state,
        _useSessionsUuids: state._useSessionsUuids?.find((stateSession) =>
          isSession(stateSession, action.payload)
        )
          ? state._useSessionsUuids.map((stateSession) =>
              isSession(stateSession, action.payload)
                ? action.payload
                : stateSession
            )
          : [action.payload, ...state._useSessionsUuids],
      };
    case "sessionToggle":
      return { ...state, _useSessionsToggle: action.payload };
    case "viewUpdateCurrent":
      return { ...state, viewCurrent: action.payload };
    case "_useSessionsSet":
      return { ...state, sessions: action.payload };
    case "_useSessionsToggleClear":
      return { ...state, _useSessionToggle: null };
    default:
      console.log(action);
      throw new Error();
  }
};

export const OrchestProvider = ({ config, user_config, children }) => {
  /** @type {[IOrchestState, React.Dispatch<TOrchestAction>]} */
  const [state, dispatch] = React.useReducer(reducer, initialState);

  /** @type {IOrchestGet} */
  const get = {
    session: (session) =>
      state?.sessions?.find((stateSession) => isSession(session, stateSession)),
    currentSession: state?.sessions?.find((session) =>
      isCurrentSession(session, state)
    ),
  };

  // @ts-ignore
  const orchest = window.orchest;

  /**
   * Loading
   */
  React.useEffect(() => {
    if (config && user_config) {
      dispatch({ type: "isLoaded" });
    }
  }, [config, user_config]);

  /**
   * Alerts
   */
  React.useEffect(() => {
    if (state.alert) {
      orchest.alert(...state.alert);
    }
  }, [state.alert]);

  return (
    <OrchestContext.Provider
      value={{
        state,
        dispatch,
        get,
      }}
    >
      <SessionsProvider>{children}</SessionsProvider>
    </OrchestContext.Provider>
  );
};
