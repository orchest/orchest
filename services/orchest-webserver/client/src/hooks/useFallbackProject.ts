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

  const fallback = React.useMemo(
    () => (Boolean(storedUuid) ? projects?.[storedUuid] : projects?.[0]),
    [projects, storedUuid]
  );

  const setFallback = React.useCallback(
    (uuid: string | undefined) => setStoredUuid(uuid ?? ""),
    [setStoredUuid]
  );

  return { fallback, setFallback };
};
