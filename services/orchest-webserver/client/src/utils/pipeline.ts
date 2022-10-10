import type { PipelineRunStatus } from "@/types";
import { hasValue } from "@orchest/lib-utils";

export const PIPELINE_RUNNING_STATES: readonly PipelineRunStatus[] = [
  "PENDING",
  "STARTED",
];

export const PIPELINE_IDLING_STATES: readonly PipelineRunStatus[] = [
  "SUCCESS",
  "ABORTED",
  "FAILURE",
];

export const isPipelineRunning = (runStatus?: PipelineRunStatus) =>
  hasValue(runStatus) && PIPELINE_RUNNING_STATES.includes(runStatus);

export const isPipelineIdling = (runStatus?: PipelineRunStatus) =>
  hasValue(runStatus) && PIPELINE_IDLING_STATES.includes(runStatus);
