import { PipelineRun } from "@/types";
import { join } from "@/utils/path";
import { fetcher } from "@orchest/lib-utils";

const BASE_URL = "/catch/api-proxy/api/jobs/";

export type StatusUpdate = {
  jobUuid: string;
  runUuid: string;
  status: "PENDING" | "STARTED" | "SUCCESS" | "FAILURE" | "ABORTED";
};

export type StepStatusUpdate = StatusUpdate & { stepUuid: string };

export const fetchOne = (jobUuid: string, runUuid: string) =>
  fetcher<PipelineRun>(join(BASE_URL, jobUuid, runUuid));

export const fetchAll = (jobUuid: string) =>
  fetcher<PipelineRun[]>(join(BASE_URL, jobUuid, "pipeline_runs"));

export const setStatus = ({ jobUuid, runUuid, status }: StatusUpdate) =>
  fetcher<void>(join(BASE_URL, jobUuid, runUuid), {
    method: "PUT",
    body: JSON.stringify({ status }),
  });

export const setStepStatus = ({
  jobUuid,
  runUuid,
  stepUuid,
  status,
}: StepStatusUpdate) =>
  fetcher<void>(join(BASE_URL, jobUuid, runUuid, stepUuid), {
    method: "PUT",
    body: JSON.stringify({ status }),
  });

export const cancel = (jobUuid: string, runUuid: string) =>
  fetcher<void>(join(BASE_URL, jobUuid, runUuid), {
    method: "DELETE",
  });

export const jobRunsApi = {
  cancel,
  fetch: fetchOne,
  fetchAll,
  setStatus,
  setStepStatus,
};
