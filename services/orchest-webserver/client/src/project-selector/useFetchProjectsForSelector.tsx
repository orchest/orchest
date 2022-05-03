import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useFetchProjects } from "@/hooks/useFetchProjects";
import React from "react";

export const useFetchProjectsForSelector = (shouldFetch: boolean) => {
  const { state, dispatch } = useProjectsContext();

  const { projects } = useFetchProjects({
    // only need to fetch if `state.projects` is undefined.
    shouldFetch: shouldFetch && !state.hasLoadedProjects,
    skipDiscovery: true,
  });

  React.useEffect(() => {
    // ProjectSelector only appears at Project Root, i.e. pipelines, jobs, and environments
    // in case that project is deleted
    if (projects) dispatch({ type: "SET_PROJECTS", payload: projects });
  }, [projects, dispatch]);

  // Note that we pass along `state.projects` instead of `projects` from useFetchProjects.
  // `state.projects` should be the single source of truth,
  // as `projects` from useFetchProjects is a transitionary value from the fetcher.
  return state.projects;
};
