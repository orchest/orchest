import { FetchAllParams } from "@/api/projects/projectsApi";
import { useProjectsApi } from "@/api/projects/useProjectsApi";
import { Project } from "@/types";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useAsync } from "./useAsync";

export const useFetchProjects = ({
  activeJobCounts,
  sessionCounts,
  skipDiscovery,
}: FetchAllParams = {}) => {
  const { run, status, error } = useAsync<Project[]>();
  const init = useProjectsApi((state) => state.init);
  const projects = useProjectsApi((state) => state.projects || []);

  const refresh = React.useCallback(
    (params: Partial<FetchAllParams> = {}) =>
      run(init({ activeJobCounts, sessionCounts, skipDiscovery, ...params })),
    [init, run, activeJobCounts, sessionCounts, skipDiscovery]
  );

  React.useEffect(() => void refresh(), [refresh]);

  return {
    projects,
    isLoaded: hasValue(projects),
    /**
     * Reloads all projects with the parameters they were initialized with.
     * @param params Override the initial parameters with these values.
     */
    refresh,
    error,
    isFetching: status === "PENDING",
  };
};
