import { JobData } from "@/types";
import { useFetcher } from "./useFetcher";

export function useFetchJobs(projectUuid: string | undefined) {
  const { fetchData, data, setData, error, status } = useFetcher<
    { jobs: JobData[] },
    JobData[]
  >(
    projectUuid
      ? `/catch/api-proxy/api/jobs/?project_uuid=${projectUuid}`
      : undefined,
    { transform: (data) => data.jobs }
  );

  return {
    jobs: data,
    error,
    isFetchingJobs: status === "PENDING",
    fetchJobs: fetchData,
    setJobs: setData,
  };
}
