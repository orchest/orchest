import { useAppContext } from "@/contexts/AppContext";
import { useAsync } from "@/hooks/useAsync";
import { Job } from "@/types";
import { envVariablesDictToArray } from "@/utils/webserver-utils";
import { fetcher } from "@orchest/lib-utils";
import React from "react";

export const useFetchJob = (jobUuid?: string) => {
  const { setAlert } = useAppContext();

  const { data, error, run, status } = useAsync<Job>();
  const [job, setJob] = React.useState<Job>();

  const fetchJob = React.useCallback(() => {
    if (jobUuid)
      run(
        fetcher(
          `/catch/api-proxy/api/jobs/${jobUuid}?aggregate_run_statuses=true`
        )
      );
  }, [jobUuid, run]);

  React.useEffect(() => {
    if (error) setAlert("Error", error.message);
  }, [error, setAlert]);

  React.useEffect(() => {
    if (data) setJob(data);
  }, [data]);

  React.useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  const envVariables: { name: string; value: string }[] = React.useMemo(() => {
    return job ? envVariablesDictToArray<string>(job.env_variables) : [];
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
