import { BUILD_IMAGE_SOLUTION_VIEW } from "@/components/BuildPendingDialog";
import { useAppContext } from "@/contexts/AppContext";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import type { IOrchestSession, IOrchestSessionUuid } from "@/types";
import { checkGate } from "@/utils/webserver-utils";
import { fetcher, hasValue, HEADER } from "@orchest/lib-utils";
import pascalcase from "pascalcase";
import React from "react";

type TSessionStatus = IOrchestSession["status"];

const ENDPOINT = "/catch/api-proxy/api/sessions/";

/* Util functions
  =========================================== */

const lowerCaseFirstLetter = (str: string) =>
  str.charAt(0).toLowerCase() + str.slice(1);

function convertKeyToCamelCase<T>(data: T | undefined, keys?: string[]) {
  if (!data) return data;
  if (keys) {
    for (const key of keys) {
      data[lowerCaseFirstLetter(pascalcase(key))] = data[key];
    }
    return data as T;
  }
  return Object.entries(data).reduce((newData, curr) => {
    const [key, value] = curr;
    return {
      ...newData,
      [lowerCaseFirstLetter(pascalcase(key))]: value,
    };
  }, {}) as T;
}

type Session = {
  project_uuid?: string;
  pipeline_uuid?: string;
  projectUuid?: string;
  pipelineUuid?: string;
};

const getSessionValue = (session: Session) => {
  return {
    projectUuid: session.projectUuid || session.project_uuid,
    pipelineUuid: session.pipelineUuid || session.pipeline_uuid,
  };
};

// because project_uuid and pipeline_uuid can either be snake_case or camelCase,
// isSameSession function should be able to compare either case.
export function isSameSession(a: Session, b: Session) {
  if (!a || !b) return false;
  const sessionA = getSessionValue(a);
  const sessionB = getSessionValue(b);

  return !Object.keys(sessionA).some((key) => sessionA[key] !== sessionB[key]);
}

/* Matchers
  =========================================== */

const isStoppable = (status: TSessionStatus) =>
  ["RUNNING", "LAUNCHING"].includes(status || "");

/* Fetchers
  =========================================== */

const stopSession = ({ pipelineUuid, projectUuid }: IOrchestSessionUuid) =>
  fetcher(`${ENDPOINT}${projectUuid}/${pipelineUuid}`, {
    method: "DELETE",
  });

/**
 *
 * Context
 */

type SessionsContextState = {
  sessions: IOrchestSession[] | undefined;
  sessionsIsLoading: boolean;
  sessionsKillAllInProgress?: boolean;
};

type Action =
  | {
      type: "SET_SESSIONS";
      payload: Pick<SessionsContextState, "sessions"> & {
        sessionsIsLoading?: boolean;
      };
    }
  | { type: "SET_IS_KILLING_ALL_SESSIONS"; payload: boolean };

type ActionCallback = (previousState: SessionsContextState) => Action;

type SessionsContextAction = Action | ActionCallback;

type ToggleSessionFunction = (
  payload: IOrchestSessionUuid & {
    shouldStart?: boolean;
    requestedFromView?: BUILD_IMAGE_SOLUTION_VIEW;
    onBuildComplete?: () => void;
    onCancelBuild?: () => void;
  }
) => Promise<void>;

type SessionsContext = {
  state: SessionsContextState;
  dispatch: React.Dispatch<SessionsContextAction>;
  getSession: (session: Session) => IOrchestSession | undefined;
  toggleSession: ToggleSessionFunction;
  deleteAllSessions: () => Promise<void>;
};

const Context = React.createContext<SessionsContext | null>(null);
export const useSessionsContext = () =>
  React.useContext(Context) as SessionsContext;

const reducer = (
  state: SessionsContextState,
  _action: SessionsContextAction
) => {
  const action = _action instanceof Function ? _action(state) : _action;

  switch (action.type) {
    case "SET_SESSIONS": {
      const { sessionsIsLoading, sessions } = action.payload;

      return {
        ...state,
        sessions,
        sessionsIsLoading: hasValue(sessionsIsLoading)
          ? sessionsIsLoading
          : state.sessionsIsLoading,
      };
    }
    case "SET_IS_KILLING_ALL_SESSIONS":
      return { ...state, sessionsKillAllInProgress: action.payload };

    default: {
      console.error(action);
      return state;
    }
  }
};

const initialState: SessionsContextState = {
  sessions: undefined,
  sessionsIsLoading: true,
  sessionsKillAllInProgress: false,
};

/* Provider
  =========================================== */

export const SessionsContextProvider: React.FC = ({ children }) => {
  const { setAlert, requestBuild } = useAppContext();
  const projectsContext = useProjectsContext();

  const [state, dispatch] = React.useReducer(reducer, initialState);

  const getSession = React.useCallback(
    (session: Session) =>
      state.sessions?.find((stateSession) =>
        isSameSession(session, stateSession)
      ),
    [state]
  );

  /**
   * a wrapper of SET_SESSIONS action dispatcher, used for updating single session
   */
  const setSession = React.useCallback(
    (newSessionData?: IOrchestSession) => {
      if (!newSessionData) return;
      dispatch((currentState) => {
        let found = false;
        const newSessions = (currentState.sessions || []).map((sessionData) => {
          const isMatching = isSameSession(newSessionData, sessionData);
          if (isMatching) found = true;

          return isMatching
            ? { ...sessionData, ...newSessionData }
            : sessionData;
        });

        // not found, insert newSessionData as the temporary session
        const outcome: IOrchestSession[] = found
          ? newSessions
          : [...newSessions, { ...newSessionData, status: "LAUNCHING" }];

        return {
          type: "SET_SESSIONS",
          payload: {
            sessions: outcome,
          },
        };
      });
    },
    [dispatch]
  );

  const startSession = React.useCallback(
    async (payload: IOrchestSessionUuid) => {
      setSession({ ...payload, status: "LAUNCHING" });
      try {
        const sessionDetails = await fetcher<IOrchestSession>(ENDPOINT, {
          method: "POST",
          headers: HEADER.JSON,
          body: JSON.stringify({
            pipeline_uuid: payload.pipelineUuid,
            project_uuid: payload.projectUuid,
          }),
        });
        setSession(sessionDetails);
      } catch (err) {
        if (err?.message) {
          setAlert("Error", `Error while starting the session: ${err.message}`);
        }

        console.error(err);
      }
    },
    [setSession, setAlert]
  );

  const setReadOnly = React.useCallback(
    (value: boolean) => {
      projectsContext.dispatch({
        type: "SET_PIPELINE_IS_READONLY",
        payload: value,
      });
    },
    [projectsContext]
  );

  // NOTE: launch/delete session is an async operation from BE
  // to use toggleSession you need to make sure that your view component is added to useSessionsPoller's list
  const toggleSession: ToggleSessionFunction = React.useCallback(
    async (props) => {
      const {
        shouldStart,
        onBuildComplete,
        onCancelBuild,
        requestedFromView,
        ...payload
      } = props;
      const foundSession = state.sessions?.find((session) =>
        isSameSession(session, payload)
      );

      /* use the cashed session from useSWR or create a temporary one out of previous one */
      const session = convertKeyToCamelCase<IOrchestSession>(foundSession, [
        "project_uuid",
        "pipeline_uuid",
      ]);

      const isOperating =
        session?.status && ["STOPPING"].includes(session.status);
      const isAlreadyStopped = shouldStart === false && !session;

      if (isOperating || isAlreadyStopped) return;

      const desiredState: IOrchestSession["status"] =
        shouldStart !== undefined
          ? shouldStart
            ? "LAUNCHING"
            : "STOPPING"
          : ["LAUNCHING", "RUNNING"].includes(session?.status || "")
          ? "STOPPING"
          : "LAUNCHING";

      if (desiredState !== "STOPPING") {
        try {
          await checkGate(payload.projectUuid); // Ensure that environments are built.
        } catch (error) {
          setReadOnly(true);
          requestBuild(
            payload.projectUuid,
            error.data,
            requestedFromView || "",
            () => {
              startSession(payload);
              setReadOnly(false);
              if (onBuildComplete) onBuildComplete();
            },
            onCancelBuild
          );
          return;
        }
      }

      if (hasValue(session) && desiredState === "STOPPING") {
        setSession({ ...session, status: desiredState });
        try {
          await stopSession(session);
        } catch (error) {
          setAlert("Error", "Failed to stop session.");
          console.error(error);
        }
        return;
      }

      if (!["LAUNCHING", "RUNNING"].includes(session?.status || "")) {
        startSession(payload);
      }
    },
    [setAlert, setSession, state, startSession, requestBuild, setReadOnly]
  );

  const deleteAllSessions = React.useCallback(async () => {
    dispatch({ type: "SET_IS_KILLING_ALL_SESSIONS", payload: true });
    try {
      await Promise.all(
        (state.sessions || [])
          .map((sessionValue) => {
            const shouldStop = isStoppable(sessionValue.status);
            return shouldStop ? stopSession(sessionValue) : null;
          })
          .filter((value) => hasValue(value))
      );
      // NOTE: deleting sessions is async, we cannot manually set sessions to an empty array
      // instead, we need to count on useSessionsPoller to get updates to know if all sessions are deleted
      dispatch({ type: "SET_IS_KILLING_ALL_SESSIONS", payload: false });
    } catch (error) {
      console.error("Unable to stop all sessions", error);
    }
  }, [dispatch, state]);

  return (
    <Context.Provider
      value={{
        state,
        dispatch,
        getSession,
        toggleSession,
        deleteAllSessions,
      }}
    >
      {children}
    </Context.Provider>
  );
};
