import { Project } from "@/types";
import { fetcher } from "@orchest/lib-utils";
import { useFetcher } from "./useFetcher";

export const fetchProject = (projectUuid: string, isFullPath = false) =>
  fetcher<Project>(isFullPath ? projectUuid : `/async/projects/${projectUuid}`);

export function useFetchProject(projectUuid?: string | undefined) {
  const { fetchData, data, error, status } = useFetcher<Project>(
    projectUuid ? `/async/projects/${projectUuid}` : undefined
  );

  return {
    project: data,
    error,
    isFetching: status === "PENDING",
    fetchProject: fetchData,
  };
}
