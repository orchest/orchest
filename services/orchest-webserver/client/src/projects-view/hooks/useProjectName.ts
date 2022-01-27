import { Project } from "@/types";
import React from "react";
import { validProjectName } from "../common";

export const useProjectName = (projects: Project[]) => {
  const [projectName, setProjectName] = React.useState<string>("");

  const validation = React.useMemo(() => {
    if (!projectName) return "";
    if (projects.map((p) => p.path).includes(projectName))
      return "a project with the same name already exists.";
    const projectNameValidation = validProjectName(projectName);

    return projectNameValidation.valid ? "" : projectNameValidation.reason;
  }, [projectName, projects]);

  return [projectName, setProjectName, validation] as const;
};
