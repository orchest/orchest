import { Project } from "@/types";
import { toQueryString } from "@/utils/routing";
import { fetcher } from "@orchest/lib-utils";
import React from "react";
import { useAsync } from "./useAsync";

export const useFetchProjects = (params: {
  shouldFetch?: boolean;
  sessionCounts?: boolean;
  jobCounts?: boolean;
  skipDiscovery?: boolean;
}) => {
  const { run, data, setData, error, status } = useAsync<Project[]>();
  const { shouldFetch = true, ...restParams } = params;
  const queryString = toQueryString(restParams);

  const fetchProjects = React.useCallback(() => {
    if (!shouldFetch) return;
    return run(fetcher(`/async/projects${queryString}`));
  }, [run, shouldFetch, queryString]);

  React.useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  return {
    projects: data,
    error,
    isFetchingProjects: status === "PENDING",
    fetchProjects,
    setProjects: setData,
  };
};
