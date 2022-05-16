import { useAppContext } from "@/contexts/AppContext";
import { Job } from "@/types";
import { envVariablesDictToArray } from "@/utils/webserver-utils";
import { fetcher } from "@orchest/lib-utils";
import React from "react";
import useSWR from "swr";
import { MutatorCallback } from "swr/dist/types";

export const useFetchJob = ({
  jobUuid,
  runStatuses,
  clearCacheOnUnmount,
  revalidateOnFocus = true,
}: {
  jobUuid?: string;
  runStatuses?: boolean;
  clearCacheOnUnmount?: boolean;
  revalidateOnFocus?: boolean;
}) => {
  const { setAlert } = useAppContext();

  const cacheKey = jobUuid
    ? `/catch/api-proxy/api/jobs/${jobUuid}${
        runStatuses ? "?aggregate_run_statuses=true" : ""
      }`
    : "";

  const { data: job, mutate, error, isValidating } = useSWR<Job>(
    cacheKey || null,
    fetcher,
    { revalidateOnFocus }
  );

  const setJob = React.useCallback(
    (data?: Job | Promise<Job> | MutatorCallback<Job>) => mutate(data, false),
    [mutate]
  );

  React.useEffect(() => {
    if (error) setAlert("Error", error.message);
  }, [error, setAlert]);

  React.useEffect(() => {
    return () => {
      if (clearCacheOnUnmount) {
        setJob(undefined);
      }
    };
  }, [clearCacheOnUnmount, setJob]);

  const envVariables: { name: string; value: string }[] = React.useMemo(() => {
    return job ? envVariablesDictToArray(job.env_variables) : [];
  }, [job]);

  return {
    job,
    setJob,
    envVariables,
    fetchJob: mutate,
    fetchJobError: error,
    isFetchingJob: isValidating,
  };
};
