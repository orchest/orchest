import { hasValue } from "@orchest/lib-utils";
import { useAutoChangeProject } from "./useAutoChangeProject";
import { useFetchProjectsForSelector } from "./useFetchProjectsForSelector";
import { useGetValidProjectUuid } from "./useGetValidProjectUuid";

/**
 * `useProjectSelector` is responsible for the core logic of ProjectSelector.
 */
export const useProjectSelector = (
  projectUuidFromRoute: string | undefined,
  targetRoutePath: string | undefined,
  customNavigateTo: (projectUuid: string, path: string) => void
) => {
  // ProjectSelector only renders when the current view only concerns ONE project,
  // which can be inferred from the route path.
  // e.g.  `/pipeline`, `/jobs`.
  const shouldFetchProjects = hasValue(targetRoutePath);
  const projects = useFetchProjectsForSelector(shouldFetchProjects);

  const [
    validProjectUuid,
    shouldShowInvalidProjectUuidAlert,
  ] = useGetValidProjectUuid(projectUuidFromRoute);

  const onChangeProject = useAutoChangeProject(
    validProjectUuid,
    projectUuidFromRoute,
    targetRoutePath,
    customNavigateTo
  );

  return {
    validProjectUuid,
    projects,
    shouldShowInvalidProjectUuidAlert,
    onChangeProject,
  };
};
