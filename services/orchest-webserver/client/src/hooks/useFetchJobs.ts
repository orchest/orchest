import { Job } from "@/types";
import { fetcher } from "@orchest/lib-utils";
import React from "react";
import useSWR from "swr";
import { MutatorCallback } from "swr/dist/types";

export function useFetchJobs(projectUuid: string | undefined) {
  const { data, error, isValidating, mutate } = useSWR<Job[]>(
    projectUuid
      ? `/catch/api-proxy/api/jobs/?project_uuid=${projectUuid}`
      : null,
    (url: string) =>
      fetcher<{ jobs: Job[] }>(url).then((response) => response.jobs)
  );

  const setJobs = React.useCallback(
    (data?: Job[] | Promise<Job[]> | MutatorCallback<Job[]>) =>
      mutate(data, false),
    [mutate]
  );

  return {
    data,
    error,
    isFetchingJobs: isValidating,
    fetchJobs: mutate,
    setJobs,
  };
}
