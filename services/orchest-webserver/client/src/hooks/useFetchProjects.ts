import { FetchAllParams } from "@/api/projects/projectsApi";
import { useProjectsApi } from "@/api/projects/useProjectsApi";
import React from "react";
import { useAsync } from "./useAsync";

export const useFetchProjects = ({
  activeJobCounts,
  sessionCounts,
  skipDiscovery,
}: FetchAllParams) => {
  const { run, status, error } = useAsync<void>();
  const init = useProjectsApi((state) => state.init);
  const projects = useProjectsApi((state) => state.projects || []);

  const refresh = React.useCallback(() => {
    return run(init({ activeJobCounts, sessionCounts, skipDiscovery }));
  }, [init, run, activeJobCounts, sessionCounts, skipDiscovery]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  return { projects, refresh, error, isFetching: status === "PENDING" };
};
