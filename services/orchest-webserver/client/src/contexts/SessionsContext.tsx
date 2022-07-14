import { useAppContext } from "@/contexts/AppContext";
import {
  BUILD_IMAGE_SOLUTION_VIEW,
  useProjectsContext,
} from "@/contexts/ProjectsContext";
import type { OrchestSession, ReducerActionWithCallback } from "@/types";
import { fetcher, hasValue, HEADER } from "@orchest/lib-utils";
import React from "react";

type TSessionStatus = OrchestSession["status"];

export const SESSIONS_ENDPOINT = "/catch/api-proxy/api/sessions";

const isStoppable = (status: TSessionStatus) =>
  ["RUNNING", "LAUNCHING"].includes(status || "");

const launchSession = ({
  projectUuid,
  pipelineUuid,
}: {
  projectUuid: string;
  pipelineUuid: string;
}) => {
  return fetcher<OrchestSession>(SESSIONS_ENDPOINT, {
    method: "POST",
    headers: HEADER.JSON,
    body: JSON.stringify({
      pipeline_uuid: pipelineUuid,
      project_uuid: projectUuid,
    }),
  });
};

const killSession = ({
  projectUuid,
  pipelineUuid,
}: {
  projectUuid: string;
  pipelineUuid: string;
}) => {
  return fetcher(`${SESSIONS_ENDPOINT}/${projectUuid}/${pipelineUuid}`, {
    method: "DELETE",
  });
};

const isSessionStarted = (session?: OrchestSession) =>
  ["LAUNCHING", "RUNNING"].includes(session?.status || "");

type SessionsContextState = {
  sessions?: Record<string, OrchestSession>;
  sessionsKillAllInProgress?: boolean;
};

type Action =
  | {
      type: "SET_SESSIONS";
      payload: SessionsContextState["sessions"];
    }
  | { type: "SET_IS_KILLING_ALL_SESSIONS"; payload: boolean };

type SessionsContextAction = ReducerActionWithCallback<
  SessionsContextState,
  Action
>;

/**
 * Combine projectUuid and pipelineUuid as a key for session.
 */
export const getSessionKey = ({
  projectUuid,
  pipelineUuid,
}: {
  projectUuid: string;
  pipelineUuid: string;
}) => `${projectUuid}|${pipelineUuid}`;

type SessionsContext = {
  state: SessionsContextState;
  dispatch: React.Dispatch<SessionsContextAction>;
  getSession: (pipelineUuid?: string) => OrchestSession | undefined;
  startSession: (
    pipelineUuid: string,
    requestedFromView: BUILD_IMAGE_SOLUTION_VIEW
  ) => Promise<boolean>;
  stopSession: (pipelineUuid: string) => Promise<void>;
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
      return { ...state, sessions: action.payload };
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
  sessionsKillAllInProgress: false,
};

export const SessionsContextProvider: React.FC = ({ children }) => {
  const { setAlert } = useAppContext();
  const {
    state: { projectUuid },
    ensureEnvironmentsAreBuilt,
  } = useProjectsContext();

  const [state, dispatch] = React.useReducer(reducer, initialState);

  const getSession = React.useCallback(
    (pipelineUuid?: string) =>
      state.sessions && projectUuid && pipelineUuid
        ? state.sessions[getSessionKey({ projectUuid, pipelineUuid })]
        : undefined,
    [projectUuid, state]
  );

  const setSession = React.useCallback(
    (pipelineUuid: string, sessionData?: OrchestSession) => {
      if (!projectUuid) return;
      const sessionKey = getSessionKey({ projectUuid, pipelineUuid });
      const shouldDeleteSession = !hasValue(sessionData);

      dispatch((current) => {
        const currentSessions = current.sessions || {};

        const hasSession = hasValue(currentSessions[sessionKey]);

        if (!hasSession && shouldDeleteSession)
          return { type: "SET_SESSIONS", payload: currentSessions };
        if (shouldDeleteSession) {
          delete currentSessions[sessionKey];
          return { type: "SET_SESSIONS", payload: currentSessions };
        }

        const updatedSessionData: OrchestSession = hasSession
          ? { ...currentSessions[sessionKey], ...sessionData }
          : { ...sessionData, status: "LAUNCHING" };

        const updatedSessions: Record<string, OrchestSession> = {
          ...current.sessions,
          [sessionKey]: updatedSessionData,
        };

        return { type: "SET_SESSIONS", payload: updatedSessions };
      });
    },
    [dispatch, projectUuid]
  );

  const requestStartSession = React.useCallback(
    async (pipelineUuid: string): Promise<boolean> => {
      if (!projectUuid) return false;
      setSession(pipelineUuid, { status: "LAUNCHING" });
      try {
        const sessionData = await launchSession({ projectUuid, pipelineUuid });
        setSession(pipelineUuid, sessionData);
        return true;
      } catch (err) {
        if (err?.message) {
          setAlert("Error", `Error while starting the session: ${String(err)}`);
        }
        return false;
      }
    },
    [setAlert, setSession, projectUuid]
  );

  const startSession = React.useCallback(
    async (
      pipelineUuid: string,
      requestedFromView: BUILD_IMAGE_SOLUTION_VIEW
    ) => {
      const session = getSession(pipelineUuid);
      if (isSessionStarted(session)) return true;

      const hasBuilt = await ensureEnvironmentsAreBuilt(requestedFromView);
      if (!hasBuilt) return false;
      return requestStartSession(pipelineUuid);
    },
    [getSession, ensureEnvironmentsAreBuilt, requestStartSession]
  );

  const requestStopSession = React.useCallback(
    async (pipelineUuid: string) => {
      if (!projectUuid) return;
      setSession(pipelineUuid, { status: "STOPPING" });
      try {
        await killSession({ projectUuid, pipelineUuid });
      } catch (err) {
        if (err?.message) {
          setAlert("Error", `Error while stopping the session: ${String(err)}`);
        }
      }
    },
    [setAlert, setSession, projectUuid]
  );

  // NOTE: Make sure that your view component is added to useSessionsPoller's list.
  const stopSession = React.useCallback(
    async (pipelineUuid: string) => {
      if (!projectUuid) return;
      const sessionKey = getSessionKey({ projectUuid, pipelineUuid });
      const session = state.sessions?.[sessionKey];

      if (!session || session?.status === "STOPPING") return;

      requestStopSession(pipelineUuid);
    },
    [state.sessions, requestStopSession, projectUuid]
  );

  const deleteAllSessions = React.useCallback(async () => {
    dispatch({ type: "SET_IS_KILLING_ALL_SESSIONS", payload: true });
    try {
      await Promise.all(
        Object.entries(state.sessions || {})
          .map(([sessionKey, sessionValue]) => {
            const shouldStop = isStoppable(sessionValue.status);
            const [projectUuid, pipelineUuid] = sessionKey.split("|");
            return shouldStop
              ? killSession({ projectUuid, pipelineUuid })
              : null;
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
        startSession,
        stopSession,
        deleteAllSessions,
      }}
    >
      {children}
    </Context.Provider>
  );
};
