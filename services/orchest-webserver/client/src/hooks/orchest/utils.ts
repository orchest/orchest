import type {
  IOrchestSessionUuid,
  IOrchestSession,
  IOrchestState,
} from "@/types";

export const isSession = (a: IOrchestSessionUuid, b: IOrchestSessionUuid) =>
  a?.project_uuid === b?.project_uuid && a?.pipeline_uuid === b?.pipeline_uuid;

export const isCurrentSession = (
  session: IOrchestSession,
  state: IOrchestState
) => isSession(session, state);
