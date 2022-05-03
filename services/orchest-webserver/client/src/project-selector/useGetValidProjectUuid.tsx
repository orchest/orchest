import { useProjectsContext } from "@/contexts/ProjectsContext";
import type { Project } from "@/types";
import { hasValue } from "@orchest/lib-utils";
import React from "react";

// check whether given project is part of projects
const validateProjectUuid = (
  uuidToValidate: string | undefined | null,
  projects: Project[]
): uuidToValidate is string => {
  if (!hasValue(uuidToValidate)) return false;

  return uuidToValidate
    ? projects.some((project) => project.uuid == uuidToValidate)
    : false;
};

export const useGetValidProjectUuid = (
  projectUuidFromRoute: string | undefined,
  isMatchingProjectPaths: boolean
) => {
  const { state, dispatch } = useProjectsContext();

  const validProjectUuid = React.useMemo(() => {
    const shouldShow =
      state.hasLoadedProjects &&
      isMatchingProjectPaths &&
      state.projects.length > 0;

    if (!shouldShow) return undefined;

    const isProjectUuidFromRouteValid =
      hasValue(projectUuidFromRoute) &&
      validateProjectUuid(projectUuidFromRoute, state.projects);

    const validProjectUuid = isProjectUuidFromRouteValid
      ? projectUuidFromRoute
      : state.projects[0].uuid;

    return validProjectUuid;
  }, [
    isMatchingProjectPaths,
    projectUuidFromRoute,
    state.hasLoadedProjects,
    state.projects,
  ]);

  React.useEffect(() => {
    // Always update state.projectuuid.
    // This is the only place that set a valid projectUuid
    if (validProjectUuid) {
      dispatch({ type: "SET_PROJECT", payload: validProjectUuid });
    }
  }, [validProjectUuid, dispatch]);

  // If `project_uuid` query arg exists but not valid, user should be prompted with an alert.
  const shouldShowAlert =
    hasValue(validProjectUuid) &&
    hasValue(projectUuidFromRoute) &&
    projectUuidFromRoute !== validProjectUuid;

  return [validProjectUuid, shouldShowAlert] as const;
};
