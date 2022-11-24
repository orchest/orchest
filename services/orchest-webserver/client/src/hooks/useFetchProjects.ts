import { FetchAllParams } from "@/api/projects/projectsApi";
import { useProjectsApi } from "@/api/projects/useProjectsApi";
import { Project } from "@/types";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useAsync } from "./useAsync";

const BASE_PARAMS: FetchAllParams = {
  activeJobCounts: true,
  sessionCounts: true,
  skipDiscovery: false,
};

export const useFetchProjects = () => {
  const { run, status, error } = useAsync<Project[]>();
  const init = useProjectsApi((state) => state.init);
  const projects = useProjectsApi((state) => state.projects || []);

  const refresh = React.useCallback(
    (params: Partial<FetchAllParams> = {}) =>
      run(init({ ...BASE_PARAMS, ...params })),
    [init, run]
  );

  React.useEffect(() => void refresh(), [refresh]);

  return {
    projects,
    isLoaded: hasValue(projects),
    refresh,
    error,
    isFetching: status === "PENDING",
  };
};
