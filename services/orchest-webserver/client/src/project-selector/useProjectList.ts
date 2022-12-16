import { useDebounce } from "@/hooks/useDebounce";
import { useFetchProjects } from "@/hooks/useFetchProjects";
import React from "react";

export const useProjectList = () => {
  const { projects } = useFetchProjects();
  const [searchTerm, setSearchTerm] = React.useState("");
  const debouncedSearchTerm = useDebounce(searchTerm.trim());

  const filteredProjects = React.useMemo(() => {
    return Object.values(projects).filter((project) =>
      project.path.includes(debouncedSearchTerm)
    );
  }, [debouncedSearchTerm, projects]);

  const hasNoProjects =
    filteredProjects.length === 0 && debouncedSearchTerm.length > 0;

  return { searchTerm, setSearchTerm, filteredProjects, hasNoProjects };
};
