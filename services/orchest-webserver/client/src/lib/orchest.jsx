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
  sessions: [],
  viewCurrent: "pipeline",
  _sessionApi: null,
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
    case "sessionFetch":
      return {
        ...state,
        _sessionApi: {
          operation: "READ",
          status: "FETCHING",
          session: action.payload,
        },
      };
    case "_sessionApiUpdate":
      if (!action.payload?.session) {
        return {
          ...state,
          _sessionApi: action.payload,
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
        _sessionApi: action.payload,
      };
    case "sessionToggle":
      const sessionToToggle = state.sessions.find((session) =>
        isSession(session, action.payload)
      );

      if (
        !sessionToToggle ||
        !sessionToToggle?.status ||
        sessionToToggle.status === "STOPPED"
      ) {
        console.log("launch me");

        return {
          ...state,
          _sessionApi: {
            operation: "LAUNCH",
            status: "FETCHING",
            session: action.payload,
          },
        };
      }

      if (["STARTING", "STOPPING"].includes(sessionToToggle.status)) {
        return {
          ...state,
          alert: [
            "Error",
            "Please wait, the pipeline session is still " +
              { STARTING: "launching", STOPPING: "shutting down" }[
                sessionToToggle.status
              ] +
              ".",
          ],
        };
      }

      if (sessionToToggle.status === "RUNNING") {
        return {
          ...state,
          _sessionApi: {
            operation: "DELETE",
            status: "FETCHING",
            session: action.payload,
          },
        };
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

  /** @type {[IOrchestState, React.Dispatch<TOrchestAction>]} */
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
   * Session Launches and Deletions
   */
  React.useEffect(() => {
    if (
      state._sessionApi?.status !== "FETCHING" ||
      state._sessionApi?.operation === "READ"
    ) {
      return;
    }

    if (state._sessionApi?.operation === "LAUNCH") {
      console.log("launching session");

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
        .then((sessionDetails) => {
          console.log("value =", sessionDetails);

          dispatch({
            type: "_sessionApiUpdate",
            payload: {
              ...state?._sessionApi,
              status: "SUCCESS",
              session: { ...state?._sessionApi.session, ...sessionDetails },
            },
          });
        })
        .catch((err) => {
          if (!err.isCancelled) {
            console.log("Error during request LAUNCHing to orchest-api.");
            console.log(err);

            let error = JSON.parse(err.body);
            if (error.message == "MemoryServerRestartInProgress") {
              orchest.alert(
                "The session can't be stopped while the memory server is being restarted."
              );
            }
          }

          dispatch({
            type: "_sessionApiUpdate",
            payload: {
              ...state?._sessionApi,
              status: "ERROR",
            },
          });
        });
    }

    if (state._sessionApi.operation === "DELETE") {
      console.log("deleting session");

      fetcher(
        "/catch/api-proxy/api/sessions/${state.project_uuid}/${state.pipeline_uuid}",
        {
          method: "DELETE",
        }
      )
        .then(() =>
          dispatch({
            type: "_sessionApiUpdate",
            payload: {
              ...state._sessionApi,
              status: "SUCCESS",
              session: {
                ...state._sessionApi.session,
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
                type: "_sessionApiUpdate",
                payload: {
                  ...state._sessionApi,
                  status: "ERROR",
                },
              });
            }
          }
        });
    }
  }, [state._sessionApi]);

  /**
   * Session Fetches
   */
  useSWR(
    state?._sessionApi?.operation === "READ" &&
      state?._sessionApi?.status === "FETCHING"
      ? [
          `/catch/api-proxy/api/sessions/?project_uuid=`,
          state?._sessionApi.session?.project_uuid,
          `&pipeline_uuid=`,
          state?._sessionApi.session?.pipeline_uuid,
        ].join("")
      : null,
    fetcher,
    {
      onError: (e) => {
        if (!e.isCanceled) console.log(e);

        dispatch({
          type: "_sessionApiUpdate",
          payload: {
            operation: state._sessionApi.operation,
            status: "ERROR",
          },
        });
      },
      onSuccess: (data) => {
        console.log("updated data ", data);
        dispatch({
          type: "_sessionApiUpdate",
          payload: {
            operation: state._sessionApi.operation,
            status: "SUCCESS",
            session: {
              ...(data?.sessions?.length > 0
                ? data.sessions[0]
                : { status: "STOPPED" }),
              project_uuid: state?._sessionApi.session?.project_uuid,
              pipeline_uuid: state?._sessionApi.session?.pipeline_uuid,
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
