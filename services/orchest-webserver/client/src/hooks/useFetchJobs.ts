import { Job } from "@/types";
import { fetcher } from "@orchest/lib-utils";
import useSWR from "swr";

export function useFetchJobs(projectUuid: string | undefined) {
  const { data, error, isValidating, mutate } = useSWR<Job[]>(
    projectUuid
      ? `/catch/api-proxy/api/jobs/?project_uuid=${projectUuid}`
      : null,
    (url: string) =>
      fetcher<{ jobs: Job[] }>(url).then((response) => response.jobs)
  );
  return {
    data,
    error,
    isFetchingJobs: isValidating,
    fetchJobs: mutate,
  };
}
