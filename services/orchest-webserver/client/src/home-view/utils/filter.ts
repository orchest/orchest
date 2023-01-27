import { PipelineMetaData, PipelineRun, Project } from "@/types";
import { isJobRun } from "@/utils/pipeline-run";
import { SystemStatus } from "@/utils/system-status";

export type RunMaxAxe = "all" | "7 days" | "30 days";
export type RunSortDirection = "newest" | "oldest";

export type RunFilterState = {
  maxAge: RunMaxAxe;
  projects: Project[];
  pipelines: PipelineMetaData[];
  statuses: SystemStatus[];
  sort: RunSortDirection;
};

export const DEFAULT_FILTER: RunFilterState = {
  maxAge: "all",
  projects: [],
  pipelines: [],
  statuses: [],
  sort: "newest",
};

export const isEmptyFilter = (filter: RunFilterState) =>
  filter.maxAge === DEFAULT_FILTER.maxAge &&
  filter.projects.length === 0 &&
  filter.pipelines.length === 0 &&
  filter.statuses.length === 0;

export const maxAgeInMilliseconds = (maxAge: RunMaxAxe) => {
  switch (maxAge) {
    case "30 days":
      return 30 * 24 * 60 * 60 * 1000;
    case "7 days":
      return 7 * 24 * 60 * 60 * 1000;
    default:
      return Infinity;
  }
};

const matchesMaxAge = (run: PipelineRun, maxAge: RunMaxAxe) => {
  if (!run.started_time) return true;

  return (
    Date.parse(run.started_time) + maxAgeInMilliseconds(maxAge) > Date.now()
  );
};
const matchesStatus = (run: PipelineRun, status: SystemStatus) => {
  if (isJobRun(run) && status === "SCHEDULED") {
    return run.status === "PENDING";
  } else {
    return run.status === status;
  }
};

const matchesRunFilter = (run: PipelineRun, filter: RunFilterState) =>
  (!filter.statuses.length ||
    filter.statuses.some((status) => matchesStatus(run, status))) &&
  (!filter.projects.length ||
    filter.projects.some((project) => project.uuid === run.project_uuid)) &&
  (!filter.pipelines.length ||
    filter.pipelines.some(
      (pipeline) =>
        pipeline.project_uuid === run.project_uuid &&
        pipeline.uuid === run.pipeline_uuid
    )) &&
  matchesMaxAge(run, filter.maxAge);

const compareStartTime = (
  left: string | undefined,
  right: string | undefined
): number => {
  if (!left) return -1;
  else if (!right) return 1;
  else return left.localeCompare(right);
};

/** Filters and sorts the pipeline runs according to the filter state. */
export const filterRuns = (runs: PipelineRun[], filter: RunFilterState) =>
  runs
    .filter((run) => matchesRunFilter(run, filter))
    .sort((left, right) =>
      filter.sort === "oldest"
        ? compareStartTime(left.started_time, right.started_time)
        : compareStartTime(right.started_time, left.started_time)
    );
