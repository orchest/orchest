import { Project } from "@/types";
import { fetcher } from "@orchest/lib-utils";
import useSWR from "swr";

export function useFetchProject<T = Project>({
  projectUuid,
  selector = (p) => (p as unknown) as T,
}: {
  projectUuid?: string;
  selector?: (project: Project) => T;
}) {
  const { data, error, isValidating, revalidate } = useSWR<T>(
    projectUuid ? `/async/projects/${projectUuid}` : null,
    (url: string) =>
      fetcher<Project>(url).then((response) => selector(response))
  );
  return {
    data,
    error,
    isFetching: isValidating,
    fetchProject: revalidate,
  };
}
