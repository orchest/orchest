import { useProjectsApi } from "@/api/projects/useProjectsApi";
import { hasValue } from "@orchest/lib-utils";
import { useHydrate } from "./useHydrate";

export const useFetchProjects = () => {
  const projects = useProjectsApi((api) => api.projects);
  const fetchAll = useProjectsApi((api) => api.fetchAll);
  const state = useHydrate(fetchAll);

  return {
    projects: projects || {},
    /** Whether data has ever been fetched. */
    hasData: hasValue(projects),
    /** Whether there are some projects. */
    isEmpty: projects ? Object.keys(projects).length === 0 : true,
    ...state,
  };
};
