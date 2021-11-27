import { OrchestConfig, OrchestServerConfig, OrchestUserConfig } from "@/types";
import { fetcher } from "@orchest/lib-utils";
import React from "react";
import { IntercomProvider } from "react-use-intercom";

function parseLineBreak(lines: string) {
  if (lines === undefined) return [];

  // substitute newlines for line breaks
  let linesArr = lines.split("\n");

  let lineElements = linesArr.map((line, index) => {
    if (index !== linesArr.length - 1) {
      return (
        <>
          {line}
          <br />
        </>
      );
    } else {
      return <>{line}</>;
    }
  });
  return lineElements;
}

export type Alert = {
  title?: string | JSX.Element;
  content: string | JSX.Element | JSX.Element[];
  onClose?: () => void;
};

type AppContextState = {
  config?: OrchestConfig;
  user_config?: OrchestUserConfig;
  isLoaded: boolean;
  alerts: Alert[];
  hasUnsavedChanges: boolean;
};

type Action =
  | {
      type: "SET_ALERTS";
      payload: Alert[];
    }
  | {
      type: "SET_SERVER_CONFIG";
      payload: OrchestServerConfig;
    }
  | {
      type: "SET_HAS_UNSAVED_CHANGES";
      payload: boolean;
    };

type ActionCallback = (previousState: AppContextState) => Action;

type AppContextAction = Action | ActionCallback;

/**
 * TODO: move the following into this context
 * - isDrawer open
 * - orchest.confirm
 * - orchest.requestBuild
 * OrchestContext should only be about projects and pipelines
 */

type AppContext = {
  state: AppContextState;
  dispatch: React.Dispatch<AppContextAction>;
  setAlert: (
    title: string,
    content: string | JSX.Element | JSX.Element[],
    onClose?: () => void
  ) => void;
  deleteAlert: () => void;
  setAsSaved: (value?: boolean) => void;
};

const Context = React.createContext<AppContext | null>(null);
export const useAppContext = () => React.useContext(Context) as AppContext;

const reducer = (state: AppContextState, _action: AppContextAction) => {
  const action = _action instanceof Function ? _action(state) : _action;

  if (process.env.NODE_ENV === "development")
    console.log("(Dev Mode) useUserContext: action ", action);
  switch (action.type) {
    case "SET_ALERTS": {
      return { ...state, alerts: action.payload };
    }

    case "SET_SERVER_CONFIG": {
      const { config, user_config } = action.payload;
      return {
        ...state,
        isLoaded: true,
        user_config,
        config,
      };
    }

    case "SET_HAS_UNSAVED_CHANGES": {
      return {
        ...state,
        hasUnsavedChanges: action.payload,
      };
    }

    default: {
      console.error(action);
      return state;
    }
  }
};

const initialState: AppContextState = {
  alerts: [],
  isLoaded: false,
  hasUnsavedChanges: false,
};

export const AppContextProvider: React.FC = ({ children }) => {
  const [state, dispatch] = React.useReducer(reducer, initialState);

  if (process.env.NODE_ENV === "development" && false)
    console.log("(Dev Mode) useAppContext: state updated", state);
  /**
   * =========================== side effects
   */
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
        dispatch({ type: "SET_SERVER_CONFIG", payload: serverConfig });
      } catch (error) {
        console.error(
          `Failed to fetch server config: ${JSON.stringify(error)}`
        );
      }
    };
    fetchServerConfig();
  }, []);

  /**
   * Handle Unsaved Changes prompt
   */
  React.useEffect(() => {
    window.onbeforeunload = state.hasUnsavedChanges ? () => true : null;
  }, [state.hasUnsavedChanges]);

  /**
   * =========================== Action dispatchers
   */

  const setAlert = (
    title: string,
    content: string | JSX.Element | JSX.Element[],
    onClose?: () => void
  ) => {
    const parsedContent =
      typeof content === "string" ? parseLineBreak(content) : content;
    dispatch((store) => ({
      type: "SET_ALERTS",
      payload: [...store.alerts, { title, content: parsedContent, onClose }],
    }));
  };

  const deleteAlert = () => {
    dispatch((store) => ({
      type: "SET_ALERTS",
      payload: store.alerts.slice(1),
    }));
  };

  const setAsSaved = (value = true) => {
    dispatch({ type: "SET_HAS_UNSAVED_CHANGES", payload: !value });
  };

  return (
    <IntercomProvider appId={state.config?.INTERCOM_APP_ID}>
      <Context.Provider
        value={{
          state,
          dispatch,
          setAlert,
          deleteAlert,
          setAsSaved,
        }}
      >
        {children}
      </Context.Provider>
    </IntercomProvider>
  );
};
