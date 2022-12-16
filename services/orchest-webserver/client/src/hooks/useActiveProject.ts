import { useProjectsApi } from "@/api/projects/useProjectsApi";
import { isProjectPage } from "@/routingConfig";
import React from "react";
import { useCurrentQuery, useNavigate } from "./useCustomRoute";
import { useFallbackProject } from "./useFallbackProject";

/**
 * Returns the currently selected project (based on the current URL).
 * If no project is selected, the last used (or first available) project is returned as a fallback,
 * and the URL is updated to match the fallback project (if the current route is project-specific).
 */
export const useActiveProject = () => {
  const projects = useProjectsApi((api) => api.projects);
  const { projectUuid: queriedUuid } = useCurrentQuery();
  const navigate = useNavigate();
  const { fallback, setFallback } = useFallbackProject();
  const activeProject = React.useMemo(() => {
    return projects?.find(({ uuid }) => uuid === queriedUuid);
  }, [projects, queriedUuid]);

  React.useEffect(() => {
    if (!isProjectPage(window.location.pathname)) return;

    if (!queriedUuid && fallback) {
      navigate({
        sticky: false,
        query: { projectUuid: fallback.uuid },
        replace: true,
      });
    }
  }, [fallback, navigate, queriedUuid]);

  React.useEffect(() => {
    if (activeProject?.uuid) setFallback(activeProject?.uuid);
  }, [activeProject?.uuid, setFallback]);

  return activeProject ?? fallback;
};
