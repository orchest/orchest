import { useProjectsApi } from "@/api/projects/useProjectsApi";
import { reviewProjectNameFormat } from "@/utils/project";
import React from "react";

/**
 * Returns "human readable remarks" about a project name,
 * or `undefined` if there are no remarks.
 */
export const useReviewProjectName = (newPath = ""): string | undefined => {
  const projectMap = useProjectsApi((api) => api.projects ?? {});
  const projectPaths = React.useMemo(
    () => Object.values(projectMap).map((project) => project.path),
    [projectMap]
  );

  return React.useMemo(() => {
    if (projectPaths.includes(newPath)) {
      return "a project with this name already exists.";
    } else {
      return reviewProjectNameFormat(newPath);
    }
  }, [newPath, projectPaths]);
};
