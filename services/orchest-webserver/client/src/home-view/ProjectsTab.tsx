import { useFetchProjects } from "@/hooks/useFetchProjects";
import React from "react";
import { ProjectsEmptyState } from "./components/ProjectsEmptyState";
import { ProjectTable } from "./components/ProjectTable";

export const ProjectsTab = () => {
  const { hasData, isFetched } = useFetchProjects();

  if (isFetched && !hasData) {
    return <ProjectsEmptyState />;
  }

  return <ProjectTable />;
};
