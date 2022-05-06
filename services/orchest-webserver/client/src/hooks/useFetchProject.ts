import { Project } from "@/types";
import { fetcher } from "@orchest/lib-utils";
import useSWR from "swr";

export const fetchProject = (projectUuid: string, isFullPath = false) =>
  fetcher<Project>(isFullPath ? projectUuid : `/async/projects/${projectUuid}`);

export function useFetchProject<T = Project>({
  projectUuid,
  selector = (p) => (p as unknown) as T,
}: {
  projectUuid?: string;
  selector?: (project: Project) => T;
}) {
  const { data, error, isValidating, mutate } = useSWR<T>(
    projectUuid ? `/async/projects/${projectUuid}` : null,
    (url: string) =>
      fetchProject(url, true).then((response) => selector(response))
  );
  return {
    data,
    error,
    isFetching: isValidating,
    fetchProject: mutate,
  };
}
