import { JobRunsPageQuery } from "@/api/job-runs/jobRunsApi";
import { useJobRunsApi } from "@/api/job-runs/useJobRunsApi";
import { useAsync } from "@/hooks/useAsync";
import React from "react";

export const useJobRunsPage = ({
  fuzzyFilter,
  page,
  pageSize,
}: JobRunsPageQuery) => {
  const currentPage = useJobRunsApi((api) => api.page);
  const fetchPage = useJobRunsApi((api) => api.fetchPage);
  const { error, run, status } = useAsync();

  React.useEffect(() => {
    run(fetchPage({ fuzzyFilter, page, pageSize })).catch();
  }, [fetchPage, fuzzyFilter, page, pageSize, run]);

  return { page: currentPage, isFetching: status === "PENDING", error };
};
