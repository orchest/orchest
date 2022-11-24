import { useProjectsApi } from "@/api/projects/useProjectsApi";
import React from "react";
import { useLocalStorage } from "./useLocalStorage";

const STORAGE_KEY = "pipelineEditor.lastSeenProjectUuid";

/**
 * Returns the last used project, or the first available project.
 * Useful when there is no `project_uuid` available in the URL.
 */
export const useFallbackProject = () => {
  const projects = useProjectsApi((api) => api.projects);
  const [storedUuid, setStoredUuid] = useLocalStorage(STORAGE_KEY, "");

  const lastUsedProject = React.useMemo(
    () =>
      Boolean(storedUuid)
        ? projects?.find(({ uuid }) => uuid === storedUuid)
        : undefined,
    [projects, storedUuid]
  );

  const update = React.useCallback(
    (uuid: string | undefined) => setStoredUuid(uuid ?? ""),
    [setStoredUuid]
  );

  return [lastUsedProject ?? projects?.[0], update] as const;
};
