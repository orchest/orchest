import { useAppContext } from "@/contexts/AppContext";
import { useAsync } from "@/hooks/useAsync";
import { Job } from "@/types";
import { envVariablesDictToArray } from "@/utils/webserver-utils";
import { fetcher } from "@orchest/lib-utils";
import React from "react";

export const useFetchJob = (jobUuid?: string, runStatuses = true) => {
  const { setAlert } = useAppContext();

  const { data: job, setData: setJob, error, run, status } = useAsync<Job>();

  const fetchJob = React.useCallback(() => {
    if (jobUuid)
      run(
        fetcher(
          `/catch/api-proxy/api/jobs/${jobUuid}${
            runStatuses ? "?aggregate_run_statuses=true" : ""
          }`
        )
      );
  }, [jobUuid, run, runStatuses]);

  React.useEffect(() => {
    if (error) setAlert("Error", error.message);
  }, [error, setAlert]);

  React.useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  const envVariables: { name: string; value: string }[] = React.useMemo(() => {
    return job ? envVariablesDictToArray(job.env_variables) : [];
  }, [job]);

  return {
    job,
    setJob,
    envVariables,
    fetchJob,
    fetchJobError: error,
    fetchJobStatus: status,
  };
};
