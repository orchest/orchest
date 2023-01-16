import { JobRun, JobRunsPage, PipelineRunStatus } from "@/types";
import { join } from "@/utils/path";
import { prune } from "@/utils/record";
import { queryArgs } from "@/utils/text";
import { fetcher } from "@orchest/lib-utils";

const BASE_URL = "/catch/api-proxy/api/jobs/";

export type StatusUpdate = {
  jobUuid: string;
  runUuid: string;
  status: PipelineRunStatus;
};

export type JobRunsPageQuery = {
  page: number;
  pageSize: number;
  projectUuids?: string[];
  pipelines?: { projectUuid: string; pipelineUuid: string }[];
  jobUuids?: string[];
  statuses?: PipelineRunStatus[];
  sort?: "oldest" | "newest";
  fuzzyFilter?: string | undefined;
  /** How many milliseconds old the job run may be at most. */
  maxAge?: number;
};

const toQueryParams = (query: JobRunsPageQuery) =>
  prune({
    page: query.page,
    page_size: query.pageSize,
    sort: query.sort,
    fuzzy_filter: query.fuzzyFilter,
    project_uuid__in: query.projectUuids?.join(","),
    project_pipeline_uuid__in: query.pipelines
      ?.map(({ projectUuid, pipelineUuid }) => `${projectUuid},${pipelineUuid}`)
      .join(","),
    job_uuid__in: query.jobUuids?.join(","),
    status__in: query.statuses?.join(","),
    created_time__gt:
      query.maxAge && query.maxAge !== Infinity
        ? new Date(Date.now() - query.maxAge).toISOString().split("Z")[0]
        : undefined,
  });

export type StepStatusUpdate = StatusUpdate & { stepUuid: string };

export const fetchOne = (jobUuid: string, runUuid: string) =>
  fetcher<JobRun>(join(BASE_URL, jobUuid, runUuid));

export const fetchAll = (jobUuid: string) =>
  fetcher<JobRun[]>(join(BASE_URL, jobUuid, "pipeline_runs"));

export const fetchPage = (pageQuery: JobRunsPageQuery) =>
  fetcher<JobRunsPage>(
    join(BASE_URL, "pipeline_runs") + "?" + queryArgs(toQueryParams(pageQuery))
  );

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
  fetchOne,
  fetchAll,
  fetchPage,
  setStatus,
  setStepStatus,
};
