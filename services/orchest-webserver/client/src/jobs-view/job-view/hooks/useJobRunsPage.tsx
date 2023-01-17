import { JobRunsPageQuery } from "@/api/job-runs/jobRunsApi";
import { useJobRunsApi } from "@/api/job-runs/useJobRunsApi";
import { useHydrate } from "@/hooks/useHydrate";
import React from "react";

export const useJobRunsPage = ({
  projectUuids,
  pipelines,
  jobUuids,
  statuses,
  fuzzyFilter,
  page,
  pageSize,
  maxAge,
  sort,
}: JobRunsPageQuery) => {
  const pagination = useJobRunsApi((api) => api.pagination);
  const runs = useJobRunsApi((api) => api.runs);
  const fetchPage = useJobRunsApi((api) => api.fetchPage);
  const fetchCurrentPage = React.useCallback(
    () =>
      fetchPage({
        projectUuids,
        pipelines,
        jobUuids,
        statuses,
        fuzzyFilter,
        page,
        pageSize,
        maxAge,
        sort,
      }),
    [
      fetchPage,
      projectUuids,
      pipelines,
      jobUuids,
      statuses,
      fuzzyFilter,
      page,
      pageSize,
      maxAge,
      sort,
    ]
  );

  const state = useHydrate(fetchCurrentPage);

  return { pagination, runs, ...state };
};
