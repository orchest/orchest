// @ts-check

/**
 * @typedef {import("@/types").IOrchestSessionUuid} IOrchestSessionUuid
 * @typedef {import("@/types").IOrchestSession} IOrchestSession
 * @typedef {import("@/types").IOrchestState} IOrchestState
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
