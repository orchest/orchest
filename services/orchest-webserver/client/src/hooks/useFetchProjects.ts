import { FetchAllParams } from "@/api/projects/projectsApi";
import { ProjectMap, useProjectsApi } from "@/api/projects/useProjectsApi";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useAsync } from "./useAsync";

const BASE_PARAMS: FetchAllParams = {
  activeJobCounts: true,
  sessionCounts: true,
  skipDiscovery: false,
};

export const useFetchProjects = () => {
  const { run, status, error } = useAsync<ProjectMap>();
  const init = useProjectsApi((api) => api.init);
  const projects = useProjectsApi((api) => api.projects || {});

  const refresh = React.useCallback(
    (params: Partial<FetchAllParams> = {}) =>
      run(init({ ...BASE_PARAMS, ...params })),
    [init, run]
  );

  React.useEffect(() => void refresh(), [refresh]);

  return {
    projects,
    isLoaded: hasValue(projects),
    isFetching: status === "PENDING",
    isEmpty: Object.keys(projects).length === 0,
    refresh,
    error,
  };
};
