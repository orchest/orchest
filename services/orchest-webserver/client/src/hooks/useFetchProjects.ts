import { Project } from "@/types";
import { toQueryString } from "@/utils/routing";
import { useFetcher } from "./useFetcher";

export const useFetchProjects = (params: {
  shouldFetch?: boolean;
  sessionCounts?: boolean;
  jobCounts?: boolean;
  skipDiscovery?: boolean;
}) => {
  const { shouldFetch = true, ...restParams } = params;
  const queryString = toQueryString(restParams);

  const { fetchData, data, setData, error, status } = useFetcher<Project[]>(
    shouldFetch ? `/async/projects${queryString}` : undefined
  );

  return {
    projects: data,
    error,
    status,
    isFetchingProjects: status === "PENDING",
    fetchProjects: fetchData,
    setProjects: setData,
  };
};
