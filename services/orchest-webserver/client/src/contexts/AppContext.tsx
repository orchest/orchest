import {
  BuildRequest,
  EnvironmentValidationData,
  OrchestConfig,
  OrchestServerConfig,
  OrchestUserConfig,
} from "@/types";
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
  onConfirm: () => Promise<boolean>; // if it's confirm type, something needs to happen. Otherwise, it could have been an alert.
  onCancel?: () => Promise<false>;
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
  onConfirm: () => Promise<boolean>,
  onCancel?: () => Promise<false>
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
  buildRequest?: BuildRequest;
  hasUnsavedChanges: boolean;
  isCommandPaletteOpen: boolean;
};

type Action =
  | {
      type: "SET_PROMPT_MESSAGES";
      payload: PromptMessage[];
    }
  | {
      type: "SET_BUILD_REQUEST";
      payload: BuildRequest | undefined;
    }
  | {
      type: "SET_SERVER_CONFIG";
      payload: OrchestServerConfig;
    }
  | {
      type: "SET_HAS_UNSAVED_CHANGES";
      payload: boolean;
    }
  | {
      type: "SET_IS_COMMAND_PALETTE_OPEN";
      payload: boolean;
    };

type ActionCallback = (previousState: AppContextState) => Action;

type AppContextAction = Action | ActionCallback;

type AlertDispatcher = (
  title: string,
  content: string | JSX.Element | JSX.Element[],
  onConfirm?: () => void
) => void;

export type ConfirmDispatcher = (
  title: string,
  content: string | JSX.Element | JSX.Element[],
  onConfirm: () => Promise<boolean>,
  onCancel?: () => Promise<false>
) => Promise<boolean>;

export type RequestBuildDispatcher = (
  projectUuid: string,
  environmentValidationData: EnvironmentValidationData,
  requestedFromView: string,
  onBuildComplete: () => void,
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
  requestBuild: RequestBuildDispatcher;
  deletePromptMessage: () => void;
  setAsSaved: (value?: boolean) => void;
};

const Context = React.createContext<AppContext | null>(null);
export const useAppContext = () => React.useContext(Context) as AppContext;

const reducer = (state: AppContextState, _action: AppContextAction) => {
  const action = _action instanceof Function ? _action(state) : _action;

  switch (action.type) {
    case "SET_PROMPT_MESSAGES": {
      return { ...state, promptMessages: action.payload };
    }

    case "SET_BUILD_REQUEST": {
      return { ...state, buildRequest: action.payload };
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

    case "SET_IS_COMMAND_PALETTE_OPEN": {
      return {
        ...state,
        isCommandPaletteOpen: action.payload,
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
  isCommandPaletteOpen: false,
};

const withPromptMessageDispatcher = function <T extends PromptMessage>(
  dispatch: (value: AppContextAction) => void,
  convert: PromptMessageConverter<T>
) {
  const dispatcher = (
    title: string,
    content: string | JSX.Element | JSX.Element[],
    onConfirm?: () => Promise<boolean>, // is required for 'confirm'
    onCancel?: () => Promise<false>
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
};

const convertAlert: PromptMessageConverter<Alert> = (
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
};

const convertConfirm: PromptMessageConverter<Confirm> = (
  title: string,
  content: string | JSX.Element | JSX.Element[],
  onConfirm: () => Promise<boolean>,
  onCancel?: () => Promise<false>
) => {
  return {
    type: "confirm",
    title,
    content: contentParser(content),
    onConfirm,
    onCancel,
  };
};

export const AppContextProvider: React.FC = ({ children }) => {
  const [state, dispatch] = React.useReducer(reducer, initialState);

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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const setAlert = React.useCallback(
    withPromptMessageDispatcher<Alert>(dispatch, convertAlert),
    [dispatch]
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const setConfirm = React.useCallback(
    withPromptMessageDispatcher<Confirm>(dispatch, convertConfirm),
    [dispatch]
  );

  const deletePromptMessage = React.useCallback(() => {
    dispatch((store) => ({
      type: "SET_PROMPT_MESSAGES",
      payload: store.promptMessages.slice(1),
    }));
  }, [dispatch]);

  const setAsSaved = React.useCallback(
    (value = true) => {
      dispatch({ type: "SET_HAS_UNSAVED_CHANGES", payload: !value });
    },
    [dispatch]
  );

  const requestBuild = React.useCallback(
    (
      projectUuid: string,
      environmentValidationData: EnvironmentValidationData,
      requestedFromView: string,
      onBuildComplete: () => void,
      onCancel?: () => void
    ) => {
      dispatch({
        type: "SET_BUILD_REQUEST",
        payload: {
          projectUuid,
          environmentValidationData,
          requestedFromView,
          onBuildComplete,
          onCancel,
        },
      });
    },
    [dispatch]
  );

  return (
    <IntercomProvider appId={state.config?.INTERCOM_APP_ID}>
      <Context.Provider
        value={{
          state,
          dispatch,
          setAlert,
          setConfirm,
          requestBuild,
          deletePromptMessage,
          setAsSaved,
        }}
      >
        {state.isLoaded ? children : null}
      </Context.Provider>
    </IntercomProvider>
  );
};
