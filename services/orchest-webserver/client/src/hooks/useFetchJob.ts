import { JobData } from "@/types";
import { useFetcher } from "./useFetcher";

export function useFetchJob({
  jobUuid,
  runStatuses,
}: {
  jobUuid: string | undefined;
  runStatuses?: boolean;
}) {
  const { fetchData, data, setData, error, status } = useFetcher<JobData>(
    jobUuid
      ? `/catch/api-proxy/api/jobs/${jobUuid}${
          runStatuses ? "?aggregate_run_statuses=true" : ""
        }`
      : undefined
  );

  return {
    job: data,
    error,
    isFetchingJob: status === "PENDING",
    fetchJob: fetchData,
    setJob: setData,
  };
}
