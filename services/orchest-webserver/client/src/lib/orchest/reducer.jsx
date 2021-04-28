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
  viewCurrent: "pipeline",
  _useSessionsUuids: [],
  _useSessionsToggle: null,
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
        _useSessionsUuids: state._useSessionsUuids?.find((stateSession) =>
          isSession(stateSession, action.payload)
        )
          ? state._useSessionsUuids.map((stateSession) =>
              isSession(stateSession, action.payload)
                ? action.payload
                : stateSession
            )
          : [action.payload, ...state._useSessionsUuids],
      };
    case "sessionToggle":
      return { ...state, _useSessionsToggle: action.payload };
    case "viewUpdateCurrent":
      return { ...state, viewCurrent: action.payload };
    default:
      console.log(action);
      throw new Error();
  }
};
