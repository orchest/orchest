import { JobRun, PipelineRun } from "@/types";

export const canCancelRun = (run: PipelineRun): run is PipelineRun =>
  run?.status === "STARTED" || run?.status === "PENDING";

export const isJobRun = (run: PipelineRun | JobRun): run is JobRun =>
  "job_uuid" in run;
