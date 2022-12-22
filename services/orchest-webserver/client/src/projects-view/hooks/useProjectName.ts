import { useProjectsApi } from "@/api/projects/useProjectsApi";
import React from "react";
import { validProjectName } from "../common";

export const useProjectName = () => {
  const projects = useProjectsApi((api) => Object.values(api.projects ?? {}));
  const [projectName, setProjectName] = React.useState<string>("");

  const validation = React.useMemo(() => {
    if (!projectName) return "";
    if (projects.map((p) => p.path).includes(projectName))
      return "Project name already exists.";
    const projectNameValidation = validProjectName(projectName);

    return projectNameValidation.valid ? "" : projectNameValidation.reason;
  }, [projectName, projects]);

  return [projectName, setProjectName, validation] as const;
};
