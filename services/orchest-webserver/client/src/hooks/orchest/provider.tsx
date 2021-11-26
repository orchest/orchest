import type {
  IOrchestState,
  OrchestAction,
  OrchestServerConfig,
} from "@/types";
import { fetcher, uuidv4 } from "@orchest/lib-utils";
import React from "react";
import { IntercomProvider } from "react-use-intercom";
import { useLocalStorage } from "../local-storage";
import { OrchestContext } from "./context";

type OrchestActionCallback = (currentState: IOrchestState) => OrchestAction;
type OrchestContextAction = OrchestAction | OrchestActionCallback;

const reducer = (state: IOrchestState, _action: OrchestContextAction) => {
  const action = _action instanceof Function ? _action(state) : _action;

  switch (action.type) {
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
  unsavedChanges: false,
  drawerIsOpen: true,
};

export const OrchestProvider: React.FC = ({ children }) => {
  const [drawerIsOpen, setDrawerIsOpen] = useLocalStorage("drawer", true);

  const [state, dispatch] = React.useReducer(reducer, {
    ...initialState,
    drawerIsOpen,
  });

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
        }}
      >
        {children}
      </OrchestContext.Provider>
    </IntercomProvider>
  );
};
