import { useAppContext } from "@/contexts/AppContext";
import type { IOrchestSession, IOrchestSessionUuid } from "@/types";
import { fetcher } from "@/utils/fetcher";
import { HEADER } from "@orchest/lib-utils";
import pascalcase from "pascalcase";
import React from "react";
import useSWR from "swr";

type TSessionStatus = IOrchestSession["status"];

const ENDPOINT = "/catch/api-proxy/api/sessions/";

/* Util functions
  =========================================== */

const lowerCaseFirstLetter = (str: string) =>
  str.charAt(0).toLowerCase() + str.slice(1);

function convertKeyToCamelCase<T>(data: T, keys?: string[]) {
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

const getSessionValue = (session: Session | null) => {
  return (
    session && {
      projectUuid: session.projectUuid || session.project_uuid,
      pipelineUuid: session.pipelineUuid || session.pipeline_uuid,
    }
  );
};

// because project_uuid and pipeline_uuid can either be snake_case or camelCase,
// isSession function should be able to compare either case.
export const isSession = (a: Session, b: Session) => {
  if (!a || !b) return false;
  const sessionA = getSessionValue(a);
  const sessionB = getSessionValue(b);

  return !Object.keys(sessionA).some((key) => sessionA[key] !== sessionB[key]);
};

/* Matchers
  =========================================== */

const isStoppable = (status: TSessionStatus) =>
  ["RUNNING", "LAUNCHING"].includes(status);

const isWorking = (status: TSessionStatus) =>
  ["LAUNCHING", "STOPPING"].includes(status);

/* Fetchers
  =========================================== */

export const stopSession = ({
  pipelineUuid,
  projectUuid,
}: IOrchestSessionUuid) =>
  fetcher(`${ENDPOINT}${projectUuid}/${pipelineUuid}`, {
    method: "DELETE",
  });

/**
 *
 * Context
 */

type SessionsContextState = {
  sessions?: IOrchestSession[] | [];
  sessionsIsLoading?: boolean;
  sessionsKillAllInProgress?: boolean;
  _sessionsToFetch?: IOrchestSessionUuid[] | [];
  _startSessionPayload?: IOrchestSessionUuid;
  _sessionsIsPolling: boolean;
};

type Action =
  | {
      type: "sessionToggle";
      payload: IOrchestSessionUuid;
    }
  | { type: "_sessionsToggleClear" }
  | {
      type: "_sessionsSet";
      payload: Pick<SessionsContextState, "sessions" | "sessionsIsLoading">;
    }
  | { type: "sessionsKillAll" }
  | { type: "_sessionsKillAllClear" }
  | { type: "_sessionsPollingStart" }
  | { type: "_sessionsPollingClear" };

type ActionCallback = (previousState: SessionsContextState) => Action;

type SessionsContextAction = Action | ActionCallback;

type SessionsContext = {
  state: SessionsContextState;
  dispatch: React.Dispatch<SessionsContextAction>;
  getSession: (
    session: Pick<IOrchestSession, "pipelineUuid" | "projectUuid">
  ) => IOrchestSession | undefined;
};

const Context = React.createContext<SessionsContext | null>(null);
export const useSessionsContext = () =>
  React.useContext(Context) as SessionsContext;

const reducer = (
  state: SessionsContextState,
  _action: SessionsContextAction
) => {
  const action = _action instanceof Function ? _action(state) : _action;

  if (process.env.NODE_ENV === "development")
    console.log("(Dev Mode) useUserContext: action ", action);
  switch (action.type) {
    case "sessionToggle":
      return { ...state, _startSessionPayload: action.payload };
    case "_sessionsToggleClear":
      return { ...state, _startSessionPayload: null };
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

    default: {
      console.error(action);
      return state;
    }
  }
};

const initialState: SessionsContextState = {
  sessions: [],
  sessionsIsLoading: true,
  sessionsKillAllInProgress: false,
  _sessionsToFetch: [],
  _startSessionPayload: null,
  _sessionsIsPolling: false,
};

/* Provider
  =========================================== */

export const SessionsContextProvider: React.FC = ({ children }) => {
  const appContext = useAppContext();

  const [state, dispatch] = React.useReducer(reducer, initialState);

  const getSession = (
    session: Pick<IOrchestSession, "pipelineUuid" | "projectUuid">
  ) => state.sessions.find((stateSession) => isSession(session, stateSession));

  /**
   * Use SWR to fetch and cache the data from our sessions endpoint
   *
   * Note: the endpoint does **not** return `STOPPED` sessions. This is handled
   * in a later side-effect.
   */
  const { data, mutate, error } = useSWR<{
    sessions: (IOrchestSession & {
      project_uuid: string;
      pipeline_uuid: string;
    })[];
    status: TSessionStatus;
  }>(ENDPOINT, fetcher, {
    refreshInterval: state._sessionsIsPolling ? 1000 : 0,
  });

  const isLoading = !data && !error;
  const isLoaded = !isLoading;

  if (error) {
    console.error("Unable to fetch sessions", error);
  }

  /**
   * SYNC
   *
   * Push SWR changes to Orchest Context when at least one session exists
   * NOTE: we need to convert project_uuid and pipeline_uuid to camelcase because they were used everywhere
   */
  React.useEffect(() => {
    const sessions =
      data?.sessions.map((session) =>
        convertKeyToCamelCase(session, ["project_uuid", "pipeline_uuid"])
      ) || [];

    dispatch({
      type: "_sessionsSet",
      payload: {
        sessions: sessions as IOrchestSession[],
        sessionsIsLoading: isLoading,
      },
    });
  }, [data, isLoading]);

  /**
   * TOGGLE
   */
  React.useEffect(() => {
    const foundSession =
      isLoaded &&
      data?.sessions?.find((dataSession) =>
        isSession(dataSession, state?._startSessionPayload)
      );

    // no cashed session from useSWR, nor previous session in the memory
    if (!foundSession && !state._startSessionPayload) {
      dispatch({ type: "_sessionsToggleClear" });
      return;
    }

    /* use the cashed session from useSWR or create a temporary one out of previous one */
    const session = convertKeyToCamelCase<IOrchestSession>(foundSession, [
      "project_uuid",
      "pipeline_uuid",
    ]) || { ...state._startSessionPayload, status: null };

    /**
     * Any session-specific cache mutations must be made with this helper to
     * ensure we're only mutating the requested session
     */
    const mutateSession = (
      newSessionData?: Partial<IOrchestSession>,
      shouldRevalidate?: boolean
    ) =>
      mutate(
        (cachedData) =>
          newSessionData && {
            ...cachedData,
            sessions: cachedData?.sessions.map((sessionData) =>
              sessionData && isSession(session, sessionData)
                ? { ...sessionData, ...newSessionData }
                : sessionData
            ),
          },
        shouldRevalidate
      );

    /**
     * LAUNCH
     */
    if (!session.status) {
      mutateSession({ status: "LAUNCHING" }, false);

      fetcher(ENDPOINT, {
        method: "POST",
        headers: HEADER.JSON,
        body: JSON.stringify({
          pipeline_uuid: session.pipelineUuid,
          project_uuid: session.projectUuid,
        }),
      })
        .then((sessionDetails) => mutateSession(sessionDetails))
        .catch((err) => {
          if (err?.message) {
            appContext.setAlert(
              "Error",
              `Error while starting the session: ${err.message}`
            );
          }

          console.error(err);
        });

      dispatch({ type: "_sessionsToggleClear" });
      return;
    }

    /**
     * WORKING
     * Note: Our UI should prevent users from ever seeing this error – e.g. by
     * disabling buttons – but it's here just in case.
     */
    if (isWorking(session.status)) {
      appContext.setAlert(
        "Error",
        `Please wait, the pipeline session is still ${
          { STARTING: "launching", STOPPING: "shutting down" }[session.status]
        }.`
      );

      dispatch({ type: "_sessionsToggleClear" });
      return;
    }

    /**
     * DELETE
     */
    if (isStoppable(session.status)) {
      mutateSession({ status: "STOPPING" }, false);

      stopSession(session)
        .then(() => mutate())
        .catch((err) => {
          console.error(err);
        });
      dispatch({ type: "_sessionsToggleClear" });
      return;
    }

    dispatch({ type: "_sessionsToggleClear" });
  }, [state._startSessionPayload]);

  /**
   * DELETE ALL
   */
  React.useEffect(() => {
    if (state.sessionsKillAllInProgress !== true || !data) return;

    // Mutate `isStoppable` sessions to "STOPPING"
    mutate(
      (cachedData) => ({
        ...cachedData,
        sessions: cachedData?.sessions.map((sessionValue) => ({
          ...sessionValue,
          status: isStoppable(sessionValue.status)
            ? "STOPPING"
            : sessionValue.status,
        })),
      }),
      false
    );

    // Send delete requests for `isStoppable` sessions
    Promise.all(
      data?.sessions
        .filter((sessionData) => isStoppable(sessionData.status))
        .map((sessionData) => {
          stopSession({
            projectUuid: sessionData.project_uuid,
            pipelineUuid: sessionData.pipeline_uuid,
          });
        })
    )
      .then(() => {
        mutate();
        dispatch({
          type: "_sessionsKillAllClear",
        });
      })
      .catch((err) => {
        console.error("Unable to stop all sessions", err);
        dispatch({
          type: "_sessionsKillAllClear",
        });
      });
  }, [state.sessionsKillAllInProgress]);

  return (
    <Context.Provider
      value={{
        state,
        dispatch,
        getSession,
      }}
    >
      {children}
    </Context.Provider>
  );
};
