import { useDebounce } from "@/hooks/useDebounce";
import { Project } from "@/types";
import React from "react";

export const useProjectList = (projects: Project[]) => {
  const [searchTerm, setSearchTerm] = React.useState("");
  const debouncedSearchTerm = useDebounce(searchTerm.trim());

  const filteredProjects = React.useMemo(() => {
    return projects.filter((project) =>
      project.path.includes(debouncedSearchTerm)
    );
  }, [debouncedSearchTerm, projects]);

  const hasNoProjects =
    filteredProjects.length === 0 && debouncedSearchTerm.length > 0;

  return { searchTerm, setSearchTerm, filteredProjects, hasNoProjects };
};
