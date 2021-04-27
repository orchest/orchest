// @ts-check
import { uuidv4 } from "@orchest/lib-utils";

/**
 * @typedef {import("@/types").TOrchestAction} TOrchestAction
 * @typedef {import("@/types").IOrchestGet} IOrchestGet
 * @typedef {import("@/types").IOrchestSessionUuid} IOrchestSessionUuid
 * @typedef {import("@/types").IOrchestSession} IOrchestSession
 * @typedef {import("@/types").IOrchestState} IOrchestState
 * @typedef {import("@/types").IOrchestContext} IOrchestContext
 */

/**
 * @param {Partial<IOrchestSessionUuid>} a
 * @param {Partial<IOrchestSessionUuid>} b
 */
export const isSession = (a, b) =>
  a?.project_uuid === b?.project_uuid && a?.pipeline_uuid === b?.pipeline_uuid;

/**
 * @param {IOrchestSession} session
 * @param {IOrchestState} state
 */
export const isCurrentSession = (session, state) => isSession(session, state);

/**
 * @type {IOrchestState}
 */
export const initialState = {
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
 * @param {IOrchestState} state
 * @param {TOrchestAction} action
 * @returns
 */
export const reducer = (state, action) => {
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
};
