import { useJobsApi } from "@/api/jobs/useJobsApi";
import { useHydrate } from "./useHydrate";

export function useFetchJobs() {
  const jobs = useJobsApi((api) => api.jobs);
  const fetchAll = useJobsApi((api) => api.fetchAll);
  const state = useHydrate(fetchAll);

  return { jobs, ...state };
}
