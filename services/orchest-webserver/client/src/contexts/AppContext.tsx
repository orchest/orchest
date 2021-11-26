import React from "react";

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
  alerts: Alert[];
};

type Action = {
  type: "SET_ALERTS";
  payload: Alert[];
};

type ActionCallback = (previousState: AppContextState) => Action;

type AppContextAction = Action | ActionCallback;

/**
 * TODO: move the following into this context
 * - user_config
 * - config
 * - unsavedChanges
 * - isDrawer open
 * - orchest.confirm
 * - orchest.requestBuild
 *
 * OrchestContext should only be about projects and pipelines
 */

type AppContext = {
  state: AppContextState;
  dispatch: React.Dispatch<AppContextAction>;
  setAlert: (alert: Alert) => void;
  deleteAlert: () => void;
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

    default: {
      console.error(action);
      return state;
    }
  }
};

const initialState: AppContextState = {
  alerts: [],
};

export const AppContextProvider: React.FC = ({ children }) => {
  const [state, dispatch] = React.useReducer(reducer, initialState);

  if (process.env.NODE_ENV === "development" && false)
    console.log("(Dev Mode) useAppContext: state updated", state);

  const setAlert = (alert: Alert) => {
    const parsedContent =
      typeof alert.content === "string"
        ? parseLineBreak(alert.content)
        : alert.content;
    dispatch((store) => ({
      type: "SET_ALERTS",
      payload: [
        ...store.alerts,
        { title: alert.title, content: parsedContent },
      ],
    }));
  };

  const deleteAlert = () => {
    dispatch((store) => ({
      type: "SET_ALERTS",
      payload: store.alerts.slice(1),
    }));
  };

  return (
    <Context.Provider
      value={{
        state,
        dispatch,
        setAlert,
        deleteAlert,
      }}
    >
      {children}
    </Context.Provider>
  );
};
