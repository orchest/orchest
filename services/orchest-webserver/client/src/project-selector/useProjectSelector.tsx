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
  customNavigateTo: (projectUuid: string, path: string | undefined) => void
) => {
  useFetchProjectsForSelector();

  const isMatchingProjectPaths = hasValue(targetRoutePath);
  const [
    validProjectUuid,
    shouldShowInvalidProjectUuidAlert,
  ] = useGetValidProjectUuid(projectUuidFromRoute, isMatchingProjectPaths);

  const onChangeProject = useAutoChangeProject(
    validProjectUuid,
    projectUuidFromRoute,
    targetRoutePath,
    customNavigateTo
  );

  return {
    validProjectUuid,
    shouldShowInvalidProjectUuidAlert,
    onChangeProject,
  };
};
