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
  const projects = useProjectsApi((api) => api.projects);

  const refresh = React.useCallback(
    (params: Partial<FetchAllParams> = {}) =>
      run(init({ ...BASE_PARAMS, ...params })),
    [init, run]
  );

  React.useEffect(() => void refresh(), [refresh]);

  return {
    projects: projects || {},
    /** Whether data is currently being fetched. */
    isFetching: status === "PENDING",
    /** Whether fetching has completed. */
    isFetched: status === "RESOLVED",
    /** Whether data has ever been fetched. */
    hasData: hasValue(projects),
    /** Whether there are some projects. */
    isEmpty: projects ? Object.keys(projects).length === 0 : true,
    refresh,
    error,
  };
};
