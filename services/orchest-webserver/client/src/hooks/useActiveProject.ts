import { useProjectsApi } from "@/api/projects/useProjectsApi";
import { siteMap } from "@/routingConfig";
import React from "react";
import { useCustomRoute } from "./useCustomRoute";
import { useFallbackProject } from "./useFallbackProject";

const isProjectPage = () =>
  Object.values(siteMap)
    .find((item) => item.path === window.location.pathname)
    ?.scope.includes("projectUuid") ?? false;

/**
 * Returns the currently selected project.
 * If no project is selected, the last used project is returned.
 * If there is no last used project, the first available project is returned.
 * If there are no projects available, `undefined` is returned.
 */
export const useActiveProject = () => {
  const projects = useProjectsApi((api) => api.projects);
  const { projectUuid: queriedUuid, navigateTo } = useCustomRoute();
  const [fallback, setFallbackUuid] = useFallbackProject();
  const activeProject = React.useMemo(() => {
    return projects?.find(({ uuid }) => uuid === queriedUuid);
  }, [projects, queriedUuid]);

  React.useEffect(() => {
    if (!isProjectPage()) return;

    if (!queriedUuid && fallback) {
      navigateTo(window.location.pathname, {
        query: { projectUuid: fallback.uuid },
      });
    }
  }, [fallback, navigateTo, queriedUuid]);

  React.useEffect(() => {
    if (activeProject?.uuid) setFallbackUuid(activeProject?.uuid);
  }, [activeProject?.uuid, setFallbackUuid]);

  return activeProject ?? fallback;
};
