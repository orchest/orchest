import { useProjectsApi } from "@/api/projects/useProjectsApi";
import { isProjectPage } from "@/routingConfig";
import React from "react";
import { useCustomRoute } from "./useCustomRoute";
import { useFallbackProject } from "./useFallbackProject";

/**
 * Returns the currently selected project (based on the current URL).
 * If no project is selected, the last used (or first available) project is returned as a fallback,
 * and the URL is updated to match the fallback project (if the current route is project-specific).
 */
export const useActiveProject = () => {
  const projects = useProjectsApi((api) => api.projects);
  const { projectUuid: queriedUuid, navigateTo } = useCustomRoute();
  const { fallback, setFallback } = useFallbackProject();
  const activeProject = React.useMemo(() => {
    return projects?.find(({ uuid }) => uuid === queriedUuid);
  }, [projects, queriedUuid]);

  React.useEffect(() => {
    if (!isProjectPage(window.location.pathname)) return;

    if (!queriedUuid && fallback) {
      navigateTo(window.location.pathname, {
        query: { projectUuid: fallback.uuid },
        replace: true,
      });
    }
  }, [fallback, navigateTo, queriedUuid]);

  React.useEffect(() => {
    if (activeProject?.uuid) setFallback(activeProject?.uuid);
  }, [activeProject?.uuid, setFallback]);

  return activeProject ?? fallback;
};
