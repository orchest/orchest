import { Project } from "@/types";
import { fetcher } from "@orchest/lib-utils";
import useSWR from "swr";

export const fetchProject = (projectUuid: string, isFullPath = false) =>
  fetcher<Project>(isFullPath ? projectUuid : `/async/projects/${projectUuid}`);

export function useFetchProject<T = Project>({
  projectUuid,
  selector = (p) => (p as unknown) as T,
  revalidateOnFocus = true,
}: {
  projectUuid?: string;
  selector?: (project: Project) => T;
  revalidateOnFocus?: boolean;
}) {
  const cacheKey = projectUuid ? `/async/projects/${projectUuid}` : "";
  const { data, error, isValidating, mutate } = useSWR<T>(
    cacheKey || null,
    (url: string) =>
      fetchProject(url, true).then((response) => selector(response)),
    { revalidateOnFocus }
  );

  return {
    data,
    error,
    isFetching: isValidating,
    fetchProject: mutate,
  };
}
