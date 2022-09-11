import { useJobsApi } from "@/api/jobs/useJobsApi";
import { useAsync } from "@/hooks/useAsync";
import React from "react";

export const useJob = (jobUuid: string | undefined) => {
  const { jobs, fetchOne } = useJobsApi();
  const { run, status, error } = useAsync();

  const activeJob = React.useMemo(
    () => jobs?.find(({ uuid }) => uuid === jobUuid),
    [jobs, jobUuid]
  );

  React.useEffect(() => {
    if (!activeJob && jobUuid) run(fetchOne(jobUuid)).catch();
  }, [run, activeJob, jobUuid, fetchOne]);

  return { job: activeJob, error, isFetching: status === "PENDING" };
};
