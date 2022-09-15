import { JobRunsPageQuery } from "@/api/job-runs/jobRunsApi";
import { useJobRunsApi } from "@/api/job-runs/useJobRunsApi";
import { useAsync } from "@/hooks/useAsync";
import React from "react";

export const useJobRunsPage = ({
  fuzzyFilter,
  page,
  pageSize,
}: JobRunsPageQuery) => {
  const pagination = useJobRunsApi((api) => api.pagination);
  const runs = useJobRunsApi((api) => api.runs);
  const fetchPage = useJobRunsApi((api) => api.fetchPage);
  const { error, run, status } = useAsync();

  React.useEffect(() => {
    run(fetchPage({ fuzzyFilter, page, pageSize })).catch();
  }, [fetchPage, fuzzyFilter, page, pageSize, run]);

  const refresh = React.useCallback(() => {
    run(fetchPage.bypass({ fuzzyFilter, page, pageSize })).catch();
  }, [fetchPage, fuzzyFilter, page, pageSize, run]);

  return {
    pagination,
    runs,
    refresh,
    isFetching: status === "PENDING",
    error,
  };
};
