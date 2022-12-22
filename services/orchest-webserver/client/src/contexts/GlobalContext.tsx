import { ReducerActionWithCallback } from "@/types";
import { ButtonProps } from "@mui/material/Button";
import React from "react";

type PlainTextToHtmlProps = { text: string };
const PlainTextToHtml = ({ text }: PlainTextToHtmlProps) => {
  if (text === undefined) return null;
  const linesArr = text.split("\n");
  return (
    <>
      {linesArr.map((line, index) => {
        if (index !== linesArr.length - 1) {
          return (
            <React.Fragment key={index}>
              {line}
              <br />
            </React.Fragment>
          );
        } else {
          return line;
        }
      })}
    </>
  );
};

const contentParser = (content: string | React.ReactElement | JSX.Element[]) =>
  typeof content === "string" ? <PlainTextToHtml text={content} /> : content;

export type PromptMessageType = "alert" | "confirm";

export type Alert = {
  type: "alert";
  title: string;
  content: string | React.ReactElement | JSX.Element[];
  onConfirm?: () => Promise<boolean | void> | boolean | void;
  confirmLabel?: string;
  confirmButtonColor?: ButtonProps["color"];
};

export type Confirm = {
  type: "confirm";
  title: string;
  content: string | React.ReactElement | JSX.Element[];
  onConfirm: () => Promise<boolean> | boolean; // if it's confirm type, something needs to happen. Otherwise, it could have been an alert.
  onCancel?: () => Promise<boolean | void> | void | boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmButtonColor?: ButtonProps["color"];
};

export type PromptMessage = Alert | Confirm;

type AlertConverter = (props: {
  title: string;
  content: string | React.ReactElement | JSX.Element[];
  confirmHandler?: () => Promise<boolean> | boolean;
  confirmLabel?: string;
  confirmButtonColor?: ButtonProps["color"];
}) => Alert;

type ConfirmConverter = (props: {
  title: string;
  content: string | React.ReactElement | JSX.Element[];
  confirmHandler: () => Promise<boolean> | boolean;
  cancelHandler?: () => Promise<boolean | void> | void | boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmButtonColor?: ButtonProps["color"];
}) => Confirm;

type PromptMessageConverter<T extends PromptMessage> = T extends Alert
  ? AlertConverter
  : T extends Confirm
  ? ConfirmConverter
  : never;

type GlobalContextState = {
  promptMessages: PromptMessage[];
  hasUnsavedChanges: boolean;
  isShowingOnboarding: boolean;
  // we already store hasCompletedOnboarding in localstorage, which is enough for most cases,
  // but when first-time user already wants to import a project, we want to
  // 1. show onboarding dialog (at the root level)
  // 2. after closing the onboarding dialog, show import dialog (could be at multiple places)
  // therefore, we had to lift the state into the app context
  // NOTE: although useLocalstorage has a localstorage event listener, it won't work
  //       because it is only fired when other tabs are updating the value
  hasCompletedOnboarding: boolean;
};

type Action =
  | {
      type: "SET_IS_SHOWING_ONBOARDING";
      payload: boolean;
    }
  | {
      type: "SET_PROMPT_MESSAGES";
      payload: PromptMessage[];
    }
  | {
      type: "SET_HAS_UNSAVED_CHANGES";
      payload: boolean;
    }
  | {
      type: "SET_HAS_COMPLETED_ONBOARDING";
      payload: boolean;
    };

type AppContextAction = ReducerActionWithCallback<GlobalContextState, Action>;

export type AlertDispatcher = (
  title: string,
  content: string | React.ReactElement,
  callbackOrParams?:
    | ConfirmHandler
    | {
        onConfirm: ConfirmHandler;
        confirmLabel?: string;
        confirmButtonColor?: ButtonProps["color"];
      }
) => Promise<boolean>;

export type ConfirmDispatcher = (
  title: string,
  content: string | React.ReactElement,
  callbackOrParams?:
    | ConfirmHandler
    | {
        onConfirm: ConfirmHandler;
        onCancel?: CancelHandler;
        confirmLabel?: string;
        cancelLabel?: string;
        confirmButtonColor?: ButtonProps["color"];
      }
) => Promise<boolean>;

type PromptMessageDispatcher<T extends PromptMessage> = T extends Alert
  ? AlertDispatcher
  : T extends Confirm
  ? ConfirmDispatcher
  : never;

type GlobalContext = {
  state: GlobalContextState;
  dispatch: React.Dispatch<AppContextAction>;
  setAlert: AlertDispatcher;
  setConfirm: ConfirmDispatcher;
  deletePromptMessage: () => void;
  setAsSaved: (value?: boolean) => void;
};

const Context = React.createContext<GlobalContext | null>(null);
export const useGlobalContext = () =>
  React.useContext(Context) as GlobalContext;

const reducer = (state: GlobalContextState, _action: AppContextAction) => {
  const action = _action instanceof Function ? _action(state) : _action;

  switch (action.type) {
    case "SET_IS_SHOWING_ONBOARDING": {
      return { ...state, isShowingOnboarding: action.payload };
    }
    case "SET_PROMPT_MESSAGES": {
      return { ...state, promptMessages: action.payload };
    }

    case "SET_HAS_UNSAVED_CHANGES": {
      return {
        ...state,
        hasUnsavedChanges: action.payload,
      };
    }

    case "SET_HAS_COMPLETED_ONBOARDING": {
      return {
        ...state,
        hasCompletedOnboarding: action.payload,
      };
    }

    default: {
      console.error(action);
      return state;
    }
  }
};

const initialState: GlobalContextState = {
  promptMessages: [],
  hasUnsavedChanges: false,
  hasCompletedOnboarding: false,
  isShowingOnboarding: false,
};

export type ConfirmHandler = (
  resolve: (value: boolean | PromiseLike<boolean>) => void
) => Promise<boolean> | boolean;

export type CancelHandler = (
  resolve: (value: boolean | PromiseLike<boolean>) => void
) => Promise<boolean | void> | void | boolean;

const defaultOnConfirm: ConfirmHandler = (resolve) => {
  resolve(true);
  return true;
};
const defaultOnCancel: CancelHandler = (resolve) => {
  resolve(false);
  return false;
};

const withPromptMessageDispatcher = function <T extends PromptMessage>(
  dispatch: (value: AppContextAction) => void,
  convert: PromptMessageConverter<T>
) {
  // store.promptMessages is an array of messages that contains functions like `onConfirm` and `onCancel`
  // in order to subscribe to the state of these functions, we wrap the corresponding dispatcher with a Promise<boolean>
  // therefore, when this async operation within these functions is done, the caller of this dispatcher gets notified.
  // see ProjectsView, deleteSelectedRows for example
  const dispatcher = (
    title: string,
    content: string | React.ReactElement | JSX.Element[],
    callbackOrParams?:
      | ConfirmHandler
      | {
          onConfirm: ConfirmHandler;
          onCancel?: CancelHandler;
          confirmLabel?: string;
          cancelLabel?: string;
          confirmButtonColor?: ButtonProps["color"];
        }
  ) => {
    // NOTE: consumer could either provide a callback function for onConfirm (for most use cases), or provide an object for more detailed config
    return new Promise<boolean>((resolve) => {
      const hasCustomOnConfirm =
        callbackOrParams instanceof Function || callbackOrParams?.onConfirm;

      const confirmHandler = !hasCustomOnConfirm
        ? () => defaultOnConfirm(resolve)
        : callbackOrParams instanceof Function
        ? () => callbackOrParams(resolve)
        : () => callbackOrParams?.onConfirm(resolve);

      const hasCustomOnCancel =
        !(callbackOrParams instanceof Function) && callbackOrParams?.onCancel;
      const cancelHandler = !hasCustomOnCancel
        ? () => defaultOnCancel(resolve)
        : () => callbackOrParams.onCancel && callbackOrParams.onCancel(resolve);

      const confirmLabel =
        !callbackOrParams || callbackOrParams instanceof Function
          ? "Confirm"
          : callbackOrParams?.confirmLabel || "Confirm";

      const cancelLabel =
        !callbackOrParams || callbackOrParams instanceof Function
          ? "Cancel"
          : callbackOrParams?.cancelLabel || "Cancel";

      const confirmButtonColor = !(callbackOrParams instanceof Function)
        ? typeof callbackOrParams?.confirmButtonColor === "string"
          ? callbackOrParams?.confirmButtonColor
          : undefined
        : undefined;

      const message = convert({
        title,
        content,
        confirmHandler,
        cancelHandler,
        confirmLabel,
        cancelLabel,
        confirmButtonColor,
      });

      dispatch((store) => {
        return {
          type: "SET_PROMPT_MESSAGES",
          payload: [...store.promptMessages, message],
        };
      });
    });
  };

  return dispatcher as PromptMessageDispatcher<T>;
};

const convertAlert: PromptMessageConverter<Alert> = ({
  title,
  content,
  confirmHandler,
  confirmLabel,
  confirmButtonColor,
}) => {
  return {
    type: "alert",
    title,
    content: contentParser(content),
    onConfirm: confirmHandler,
    confirmLabel,
    confirmButtonColor,
  };
};

const convertConfirm: PromptMessageConverter<Confirm> = ({
  title,
  content,
  confirmHandler,
  cancelHandler,
  confirmLabel,
  cancelLabel,
  confirmButtonColor,
}) => {
  return {
    type: "confirm",
    title,
    content: contentParser(content),
    onConfirm: confirmHandler,
    onCancel: cancelHandler,
    confirmLabel,
    cancelLabel,
    confirmButtonColor,
  };
};

export const GlobalContextProvider: React.FC = ({ children }) => {
  const [state, dispatch] = React.useReducer(reducer, initialState);

  /**
   * =========================== side effects
   */

  // Handle Unsaved Changes prompt
  React.useEffect(() => {
    window.onbeforeunload = state.hasUnsavedChanges ? () => true : null;
  }, [state.hasUnsavedChanges]);

  /**
   * =========================== Action dispatchers
   */

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

  return (
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
  );
};
