import { useFetchProjects } from "@/hooks/useFetchProjects";
import React from "react";
import { ProjectsEmptyState } from "./components/ProjectsEmptyState";
import { ProjectTable } from "./components/ProjectTable";

export const ProjectsTab = () => {
  const { isFetched, isEmpty } = useFetchProjects();

  if (isFetched && isEmpty) {
    return <ProjectsEmptyState />;
  } else {
    return <ProjectTable />;
  }
};
