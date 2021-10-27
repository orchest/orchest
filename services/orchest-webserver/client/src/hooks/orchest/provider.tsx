import type {
  IOrchestConfig,
  IOrchestGet,
  IOrchestState,
  IOrchestUserConfig,
  TOrchestAction,
} from "@/types";
import { uuidv4 } from "@orchest/lib-utils";
import * as React from "react";
import { useLocalStorage } from "../local-storage";
import { OrchestContext } from "./context";
import { OrchestSessionsProvider } from "./sessions";
import { isCurrentSession, isSession } from "./utils";

const reducer = (state: IOrchestState, action: TOrchestAction) => {
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
  config: null,
  user_config: null,
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

export interface IOrchestProviderProps {
  config: IOrchestConfig;
  user_config: IOrchestUserConfig;
}

export const OrchestProvider: React.FC<IOrchestProviderProps> = ({
  config,
  user_config,
  children,
}) => {
  const orchest = window.orchest;

  const [drawerIsOpen, setDrawerIsOpen] = useLocalStorage("drawer", true);

  const [state, dispatch] = React.useReducer(reducer, {
    ...initialState,
    drawerIsOpen,
    config,
    user_config,
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
