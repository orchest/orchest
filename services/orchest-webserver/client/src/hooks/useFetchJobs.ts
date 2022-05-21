import { Job } from "@/types";
import { fetcher } from "@orchest/lib-utils";
import React from "react";
import { useAsync } from "./useAsync";

export function useFetchJobs(projectUuid: string | undefined) {
  const { run, data, setData, error, status } = useAsync<Job[]>();

  const fetchJobs = React.useCallback(() => {
    if (!projectUuid) return;
    return run(
      fetcher(`/catch/api-proxy/api/jobs/?project_uuid=${projectUuid}`)
    );
  }, [run, projectUuid]);

  React.useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  return {
    jobs: data,
    error,
    isFetchingJobs: status === "PENDING",
    fetchJobs,
    setJobs: setData,
  };
}
