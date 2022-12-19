import { useProjectsApi } from "@/api/projects/useProjectsApi";
import { isProjectPage } from "@/routingConfig";
import React from "react";
import { useCurrentQuery, useNavigate } from "./useCustomRoute";
import { useFallbackProject } from "./useFallbackProject";

// On some navigation events, this hook runs before `projectUuid`
// is available from `useCurrentQuery`, so we give it a grace
// period before assuming that we should redirect to the fallback project.
const FALLBACK_GRACE_PERIOD = 150;

/**
 * Returns the currently selected project based on the `project_uuid` in the URL.
 * If no `project_uuid` is specified, the last used (or first available) project is returned as a fallback,
 * and the URL is updated to match the fallback project (if the current route is project-specific).
 */
export const useActiveProject = () => {
  const projects = useProjectsApi((api) => api.projects);
  const { projectUuid: queriedUuid } = useCurrentQuery();
  const navigate = useNavigate();
  const { fallback, setFallback } = useFallbackProject();
  const queriedProject = React.useMemo(() => {
    if (!queriedUuid) return undefined;
    else return projects?.[queriedUuid];
  }, [projects, queriedUuid]);

  const fallbackGracePeriodRef = React.useRef<number>();

  React.useEffect(() => {
    window.clearTimeout(fallbackGracePeriodRef.current);

    fallbackGracePeriodRef.current = window.setTimeout(() => {
      if (!isProjectPage(window.location.pathname)) return;

      if (!queriedUuid && fallback) {
        navigate({
          sticky: false,
          query: { projectUuid: fallback.uuid },
          replace: true,
        });
      }
    }, FALLBACK_GRACE_PERIOD);
  }, [fallback, navigate, queriedUuid]);

  React.useEffect(() => {
    if (queriedProject?.uuid) setFallback(queriedProject.uuid);
  }, [queriedProject?.uuid, setFallback]);

  return queriedProject ?? fallback;
};
