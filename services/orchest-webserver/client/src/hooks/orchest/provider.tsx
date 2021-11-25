import type {
  IOrchestGet,
  IOrchestState,
  OrchestAction,
  OrchestServerConfig,
} from "@/types";
import { fetcher, uuidv4 } from "@orchest/lib-utils";
import React from "react";
import { IntercomProvider } from "react-use-intercom";
import { useLocalStorage } from "../local-storage";
import { OrchestContext } from "./context";
import { OrchestSessionsProvider } from "./sessions";
import { isCurrentSession, isSession } from "./utils";

type OrchestActionCallback = (currentState: IOrchestState) => OrchestAction;
type OrchestContextAction = OrchestAction | OrchestActionCallback;

const reducer = (state: IOrchestState, _action: OrchestContextAction) => {
  const action = _action instanceof Function ? _action(state) : _action;

  switch (action.type) {
    case "alert":
      return { ...state, alert: action.payload };
    case "isLoaded":
      return {
        ...state,
        isLoading: false,
        user_config: action.payload.user_config,
        config: action.payload.config,
      };
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
      return { ...state, projectUuid: action.payload };
    case "projectsSet":
      return { ...state, projects: action.payload, hasLoadedProjects: true };
    case "sessionToggle":
      return { ...state, _sessionsToggle: action.payload };
    case "_sessionsToggleClear":
      return { ...state, _sessionsToggle: null };
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
    case "setUnsavedChanges":
      return { ...state, unsavedChanges: action.payload };
    default:
      console.log(action);
      throw new Error();
  }
};

const initialState: IOrchestState = {
  isLoading: true,
  pipelineFetchHash: null,
  pipelineName: null,
  pipelineIsReadOnly: false,
  pipelineSaveStatus: "saved",
  pipelineUuid: undefined,
  projectUuid: undefined,
  projects: [],
  hasLoadedProjects: false,
  sessions: [],
  sessionsIsLoading: true,
  sessionsKillAllInProgress: false,
  unsavedChanges: false,
  _sessionsToFetch: [],
  _sessionsToggle: null,
  drawerIsOpen: true,
};

export const OrchestProvider: React.FC = ({ children }) => {
  const orchest = window.orchest;

  const [drawerIsOpen, setDrawerIsOpen] = useLocalStorage("drawer", true);

  const [state, dispatch] = React.useReducer(reducer, {
    ...initialState,
    drawerIsOpen,
  });

  const get: IOrchestGet = {
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
    const fetchServerConfig = async () => {
      try {
        const serverConfig = await fetcher<OrchestServerConfig>(
          "/async/server-config"
        );
        dispatch({ type: "isLoaded", payload: serverConfig });
      } catch (error) {
        console.error(
          `Failed to fetch server config: ${JSON.stringify(error)}`
        );
      }
    };
    fetchServerConfig();
  }, []);

  /**
   * Sync Local Storage
   */
  React.useEffect(() => {
    setDrawerIsOpen(state?.drawerIsOpen);
  }, [state.drawerIsOpen]);

  /**
   * Handle Alerts
   */
  React.useEffect(() => {
    if (state.alert) {
      orchest.alert(...state.alert);
    }
  }, [state.alert]);

  /**
   * Handle Unsaved Changes prompt
   */
  React.useEffect(() => {
    window.onbeforeunload = state.unsavedChanges
      ? function () {
          return true;
        }
      : null;
  }, [state.unsavedChanges]);

  return (
    <IntercomProvider appId={state.config?.INTERCOM_APP_ID}>
      <OrchestContext.Provider
        value={{
          state,
          dispatch,
          get,
        }}
      >
        <OrchestSessionsProvider>{children}</OrchestSessionsProvider>
      </OrchestContext.Provider>
    </IntercomProvider>
  );
};
