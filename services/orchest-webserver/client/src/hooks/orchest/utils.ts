import type {
  IOrchestSessionUuid,
  IOrchestSession,
  IOrchestState,
} from "@/types";

export const isSession = (a: IOrchestSessionUuid, b: IOrchestSessionUuid) =>
  a?.projectUuid === b?.projectUuid && a?.pipelineUuid === b?.pipelineUuid;

export const isCurrentSession = (
  session: IOrchestSession,
  state: IOrchestState
) => isSession(session, state);
