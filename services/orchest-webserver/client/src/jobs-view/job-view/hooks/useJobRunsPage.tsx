import { JobRunsPageQuery } from "@/api/job-runs/jobRunsApi";
import { useJobRunsApi } from "@/api/job-runs/useJobRunsApi";
import { useAsync } from "@/hooks/useAsync";
import React from "react";

export const useJobRunsPage = ({
  projectUuids,
  pipelineUuids,
  jobUuids,
  statuses,
  fuzzyFilter,
  page,
  pageSize,
}: JobRunsPageQuery) => {
  const pagination = useJobRunsApi((api) => api.pagination);
  const runs = useJobRunsApi((api) => api.runs);
  const fetchPage = useJobRunsApi((api) => api.fetchPage);
  const { error, run, status } = useAsync();
  const query: JobRunsPageQuery = React.useMemo(
    () => ({
      projectUuids,
      pipelineUuids,
      jobUuids,
      statuses,
      fuzzyFilter,
      page,
      pageSize,
    }),
    [
      projectUuids,
      pipelineUuids,
      jobUuids,
      statuses,
      fuzzyFilter,
      page,
      pageSize,
    ]
  );

  React.useEffect(() => {
    run(fetchPage(query)).catch();
  }, [fetchPage, query, run]);

  const refresh = React.useCallback(() => {
    run(fetchPage.bypass(query)).catch();
  }, [fetchPage, query, run]);

  return {
    pagination,
    runs,
    refresh,
    isFetching: status === "PENDING",
    error,
  };
};
