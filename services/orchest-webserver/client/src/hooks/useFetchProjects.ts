import { FetchAllParams } from "@/api/projects/projectsApi";
import { useProjectsApi } from "@/api/projects/useProjectsApi";
import { hasValue } from "@orchest/lib-utils";
import { useHydrate } from "./useHydrate";

const BASE_PARAMS: FetchAllParams = {
  activeJobCounts: true,
  sessionCounts: true,
  skipDiscovery: false,
};

export const useFetchProjects = () => {
  const projects = useProjectsApi((api) => api.projects);
  const state = useHydrate(
    useProjectsApi((api) => api.init),
    BASE_PARAMS
  );

  return {
    projects: projects || {},
    /** Whether data has ever been fetched. */
    hasData: hasValue(projects),
    /** Whether there are some projects. */
    isEmpty: projects ? Object.keys(projects).length === 0 : true,
    ...state,
  };
};
