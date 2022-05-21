import { Job } from "@/types";
import { fetcher } from "@orchest/lib-utils";
import React from "react";
import { useAsync } from "./useAsync";

export function useFetchJob({
  jobUuid,
  runStatuses,
}: {
  jobUuid: string | undefined;
  runStatuses?: boolean;
}) {
  const { run, data, setData, error, status } = useAsync<Job>();

  const fetchJob = React.useCallback(() => {
    if (!jobUuid) return;
    return run(
      fetcher(
        `/catch/api-proxy/api/jobs/${jobUuid}${
          runStatuses ? "?aggregate_run_statuses=true" : ""
        }`
      )
    );
  }, [run, jobUuid, runStatuses]);

  React.useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  return {
    job: data,
    error,
    isFetchingJob: status === "PENDING",
    fetchJob,
    setJob: setData,
  };
}
