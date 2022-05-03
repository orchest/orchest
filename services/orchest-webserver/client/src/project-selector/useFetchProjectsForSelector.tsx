import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useFetchProjects } from "@/projects-view/hooks/useFetchProjects";
import React from "react";

export const useFetchProjectsForSelector = (shouldFetch: boolean) => {
  const { dispatch } = useProjectsContext();

  const { projects } = useFetchProjects({
    shouldFetch,
    skipDiscovery: true,
  });

  React.useEffect(() => {
    // ProjectSelector only appears at Project Root, i.e. pipelines, jobs, and environments
    // in case that project is deleted
    if (projects) dispatch({ type: "SET_PROJECTS", payload: projects });
  }, [projects, dispatch]);

  return projects;
};
