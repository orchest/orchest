import { useJobsApi } from "@/api/jobs/useJobsApi";
import { useHydrate } from "./useHydrate";

export function useFetchJobs() {
  const jobs = useJobsApi((api) => api.jobs);
  const state = useHydrate(useJobsApi((api) => api.fetchAll));

  return { jobs, ...state };
}
