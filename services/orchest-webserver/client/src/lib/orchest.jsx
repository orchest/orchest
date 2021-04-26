// @ts-check
import * as React from "react";
import useSWR from "swr";
import { uuidv4 } from "@orchest/lib-utils";
import { fetcher } from "@/lib/fetcher";

/**
 * @typedef {import("@/types").TOrchestAction} TOrchestAction
 * @typedef {import("@/types").IOrchestGet} IOrchestGet
 * @typedef {import("@/types").IOrchestSessionUuid} IOrchestSessionUuid
 * @typedef {import("@/types").IOrchestSession} IOrchestSession
 * @typedef {import("@/types").IOrchestState} IOrchestState
 * @typedef {import("@/types").IOrchestContext} IOrchestContext
 */

/**
 * @type {IOrchestState}
 */
const initialState = {
  isLoading: true,
  // @TODO ADD BROWSERCONFIG CHECK (from App.jsx)
  drawerIsOpen: true,
  pipelineFetchHash: null,
  pipelineName: null,
  pipelineIsReadOnly: false,
  pipelineSaveStatus: "saved",
  pipeline_uuid: undefined,
  project_uuid: undefined,
  _sessionApiFetch: null,
  sessionFetchStatus: null,
  sessionDeleteStatus: null,
  sessionLaunchStatus: null,
  sessions: [],
  viewCurrent: "pipeline",
};

/**
 * @param {Partial<IOrchestSessionUuid>} a
 * @param {Partial<IOrchestSessionUuid>} b
 */
const isSession = (a, b) =>
  a?.project_uuid === b?.project_uuid && a?.pipeline_uuid === b?.pipeline_uuid;

/**
 * @param {IOrchestSession} session
 * @param {IOrchestState} state
 */
const isCurrentSession = (session, state) => isSession(session, state);

/**
 * @param {IOrchestState} state
 * @param {TOrchestAction} action
 * @returns
 */
function reducer(state, action) {
  const currentSession = state.sessions.find((session) =>
    isCurrentSession(session, state)
  );

  switch (action.type) {
    case "isLoaded":
      return { ...state, isLoading: false };
    case "drawerToggle":
      console.log(state);
      // @TODO HANDLE BROSWERCONFIG CHECK
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
      return { ...state, project_uuid: action.payload };
    case "sessionSetListeners":
      return { ...state, ...action.payload };
    case "sessionClearListeners":
      return {
        ...state,
        onSessionStageChange: undefined,
        onSessionShutdown: undefined,
        onSessionFetch: undefined,
      };
    case "sessionFetch":
      return {
        ...state,
        _sessionApiFetch: {
          status: "FETCHING",
          session: action.payload,
        },
      };
    case "_sessionApiUpdate":
      if (!action.payload?.session) {
        return {
          ...state,
          _sessionApiFetch: action.payload,
        };
      }

      const hasPayloadSession = state.sessions.find((session) =>
        isSession(session, action.payload.session)
      );

      const sessions =
        typeof hasPayloadSession === "undefined"
          ? [action.payload.session, ...state.sessions]
          : state.sessions.map((session) =>
              isSession(session, action.payload.session)
                ? { ...session, ...action.payload.session }
                : session
            );

      return {
        ...state,
        sessions,
        _sessionApiFetch: action.payload,
      };
    case "sessionToggle":
      console.log(currentSession);

      if (!currentSession?.status || currentSession.status === "STOPPED") {
        return {
          ...state,
          sessionLaunchStatus: "FETCHING",
        };
      }

      if (["STARTING", "STOPPING"].includes(currentSession.status)) {
        return {
          ...state,
          alert: [
            "Error",
            "Please wait, the pipeline session is still " +
              { STARTING: "launching", STOPPING: "shutting down" }[
                currentSession.status
              ] +
              ".",
          ],
        };
      }

      if (currentSession.status === "RUNNING") {
        console.log("it's already running ya drongo");
        return { ...state, sessionCancelStatus: "FETCHING" };
      }

      return state;

    case "viewUpdateCurrent":
      return { ...state, viewCurrent: action.payload };
    default:
      console.log(action);
      throw new Error();
  }
}

/**
 * @type {React.Context<IOrchestContext>}
 */
export const OrchestContext = React.createContext(null);
export const useOrchest = () => React.useContext(OrchestContext);

export const OrchestProvider = ({ config, user_config, children }) => {
  // @ts-ignore
  const orchest = window.orchest;
  const [state, dispatch] = React.useReducer(reducer, initialState);

  console.log("State === ", state);

  /** @type {IOrchestGet} */
  const get = {
    session: (session) =>
      state?.sessions.find((stateSession) => isSession(session, stateSession)),
    currentSession: state?.sessions.find((session) =>
      isCurrentSession(session, state)
    ),
  };

  /**
   * Loading
   */
  React.useEffect(() => {
    if (config && user_config) {
      dispatch({ type: "isLoaded" });
    }
  }, [config, user_config]);

  /**
   * Alerts
   */
  React.useEffect(() => {
    if (state.alert) {
      orchest.alert(...state.alert);
    }
  }, [state]);

  /**
   * Session Launches
   */
  React.useEffect(() => {
    if (state.sessionLaunchStatus === "FETCHING") {
      console.log("launching");

      fetcher("/catch/api-proxy/api/sessions/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json;charset=UTF-8",
        },
        body: JSON.stringify({
          pipeline_uuid: state.pipeline_uuid,
          project_uuid: state.project_uuid,
        }),
      })
        .then((session) => {
          console.log("value =", session);

          dispatch({
            type: "sessionUpdate",
            payload: { sessionLaunchStatus: "SUCCESS", session },
          });
        })
        .catch((err) => {
          if (!err.isCancelled) {
            console.log(
              "Error during request DELETEing launch to orchest-api."
            );
            console.log(err);

            let error = JSON.parse(err.body);
            if (error.message == "MemoryServerRestartInProgress") {
              orchest.alert(
                "The session can't be stopped while the memory server is being restarted."
              );
            }
          }

          dispatch({
            type: "sessionUpdate",
            payload: { sessionLaunchStatus: "ERROR" },
          });
        });
    }
  }, [state.sessionLaunchStatus]);

  /**
   * Session Deletions
   */
  React.useEffect(() => {
    console.log("deleting session");

    if (state.sessionDeleteStatus === "FETCHING") {
      fetcher(
        "/catch/api-proxy/api/sessions/${state.project_uuid}/${state.pipeline_uuid}",
        {
          method: "DELETE",
        }
      )
        .then(() =>
          dispatch({
            type: "sessionUpdate",
            payload: {
              sessionDeleteStatus: "SUCCESS",
              session: {
                status: "STOPPED",
              },
            },
          })
        )
        .catch((err) => {
          if (!err.isCancelled) {
            console.log(
              "Error during request DELETEing launch to orchest-api."
            );
            console.log(err);

            if (err?.message === "MemoryServerRestartInProgress") {
              orchest.alert(
                "The session can't be stopped while the memory server is being restarted."
              );
            }

            if (err === undefined || (err && err.isCanceled !== true)) {
              dispatch({
                type: "sessionUpdate",
                payload: {
                  sessionDeleteStatus: "ERROR",
                },
              });
            }
          }
        });
    }
  }, [state.sessionDeleteStatus]);

  /**
   * Session Fetches
   */
  useSWR(
    state?._sessionApiFetch?.status === "FETCHING"
      ? [
          `/catch/api-proxy/api/sessions/?project_uuid=`,
          state?._sessionApiFetch.session?.project_uuid,
          `&pipeline_uuid=`,
          state?._sessionApiFetch.session?.pipeline_uuid,
        ].join("")
      : null,
    fetcher,
    {
      onError: (e) => {
        if (!e.isCanceled) console.log(e);

        dispatch({
          type: "_sessionApiUpdate",
          payload: {
            status: "ERROR",
          },
        });
      },
      onSuccess: (data) => {
        console.log("data", data);
        dispatch({
          type: "_sessionApiUpdate",
          payload: {
            status: "SUCCESS",
            session: {
              ...(data?.sessions?.length > 0
                ? data.sessions[0]
                : { status: "STOPPED" }),
              project_uuid: state?._sessionApiFetch.session?.project_uuid,
              pipeline_uuid: state?._sessionApiFetch.session?.pipeline_uuid,
            },
          },
        });
      },
    }
  );

  return (
    <OrchestContext.Provider
      value={{
        state,
        dispatch,
        get,
      }}
    >
      {children}
    </OrchestContext.Provider>
  );
};
