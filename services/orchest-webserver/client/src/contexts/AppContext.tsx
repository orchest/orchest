import { OrchestConfig, OrchestServerConfig, OrchestUserConfig } from "@/types";
import { fetcher } from "@orchest/lib-utils";
import React from "react";
import { IntercomProvider } from "react-use-intercom";

/** Utility functions
 =====================================================
 */
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

const contentParser = (content: string | JSX.Element | JSX.Element[]) =>
  typeof content === "string" ? parseLineBreak(content) : content;

export type PromptMessageType = "alert" | "confirm";

export type Alert = {
  type: "alert";
  title: string | JSX.Element;
  content: string | JSX.Element | JSX.Element[];
  onConfirm?: () => void;
};

export type Confirm = {
  type: "confirm";
  title: string | JSX.Element;
  content: string | JSX.Element | JSX.Element[];
  onConfirm: () => void; // if it's confirm type, something needs to happen. Otherwise, it could have been an alert.
  onCancel?: () => void;
};

export type PromptMessage = Alert | Confirm;

type AlertConverter = (
  title: string,
  content: string | JSX.Element | JSX.Element[],
  onConfirm?: () => void
) => Alert;

type ConfirmConverter = (
  title: string,
  content: string | JSX.Element | JSX.Element[],
  onConfirm: () => void,
  onCancel?: () => void
) => Confirm;

type PromptMessageConverter<T extends PromptMessage> = T extends Alert
  ? AlertConverter
  : T extends Confirm
  ? ConfirmConverter
  : never;

type AppContextState = {
  config?: OrchestConfig;
  user_config?: OrchestUserConfig;
  isLoaded: boolean;
  promptMessages: PromptMessage[];
  hasUnsavedChanges: boolean;
};

type Action =
  | {
      type: "SET_PROMPT_MESSAGES";
      payload: PromptMessage[];
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
 * - orchest.requestBuild
 * ProjectsContext should only be about projects and pipelines
 */

type AlertDispatcher = (
  title: string,
  content: string | JSX.Element | JSX.Element[],
  onConfirm?: () => void
) => void;

type ConfirmDispatcher = (
  title: string,
  content: string | JSX.Element | JSX.Element[],
  onConfirm: () => void,
  onCancel?: () => void
) => void;

type PromptMessageDispatcher<T extends PromptMessage> = T extends Alert
  ? AlertDispatcher
  : T extends Confirm
  ? ConfirmDispatcher
  : never;

type AppContext = {
  state: AppContextState;
  dispatch: React.Dispatch<AppContextAction>;
  setAlert: AlertDispatcher;
  setConfirm: ConfirmDispatcher;
  deletePromptMessage: () => void;
  setAsSaved: (value?: boolean) => void;
};

const Context = React.createContext<AppContext | null>(null);
export const useAppContext = () => React.useContext(Context) as AppContext;

const reducer = (state: AppContextState, _action: AppContextAction) => {
  const action = _action instanceof Function ? _action(state) : _action;

  if (process.env.NODE_ENV === "development")
    console.log("(Dev Mode) useUserContext: action ", action);
  switch (action.type) {
    case "SET_PROMPT_MESSAGES": {
      return { ...state, promptMessages: action.payload };
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
  promptMessages: [],
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

  /* Action dispatchers
  =========================== */

  const withPromptMessageDispatcher = React.useCallback(
    function <T extends PromptMessage>(convert: PromptMessageConverter<T>) {
      const dispatcher = (
        title: string,
        content: string | JSX.Element | JSX.Element[],
        onConfirm?: () => void, // is required for 'confirm'
        onCancel?: () => void
      ) => {
        const message = convert(title, content, onConfirm, onCancel);
        dispatch((store) => {
          return {
            type: "SET_PROMPT_MESSAGES",
            payload: [...store.promptMessages, message],
          };
        });
      };

      return dispatcher as PromptMessageDispatcher<T>;
    },
    [dispatch]
  );

  const setAlert = withPromptMessageDispatcher<Alert>(
    (
      title: string,
      content: string | JSX.Element | JSX.Element[],
      onConfirm?: () => void
    ) => {
      return {
        type: "alert",
        title,
        content: contentParser(content),
        onConfirm,
      };
    }
  );

  const setConfirm = withPromptMessageDispatcher<Confirm>(
    (
      title: string,
      content: string | JSX.Element | JSX.Element[],
      onConfirm: () => void,
      onCancel?: () => void
    ) => {
      return {
        type: "confirm",
        title,
        content: contentParser(content),
        onConfirm,
        onCancel,
      };
    }
  );

  const deletePromptMessage = () => {
    dispatch((store) => ({
      type: "SET_PROMPT_MESSAGES",
      payload: store.promptMessages.slice(1),
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
          setConfirm,
          deletePromptMessage,
          setAsSaved,
        }}
      >
        {children}
      </Context.Provider>
    </IntercomProvider>
  );
};
