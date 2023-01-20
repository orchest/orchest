import { useToggle } from "@/hooks/useToggle";
import React from "react";
import { ProjectNotFoundMessage } from "./ProjectNotFoundMessage";
import { ProjectSelectorMenu } from "./ProjectSelectorMenu";
import { ProjectSelectorToggle } from "./ProjectSelectorToggle";

export const ProjectSelector = () => {
  const [isOpen, toggle] = useToggle();

  return (
    <>
      <ProjectSelectorToggle onClick={toggle} tabIndex={0} isOpen={isOpen} />
      <ProjectSelectorMenu open={isOpen} onClose={() => toggle(false)} />
      <ProjectNotFoundMessage />
    </>
  );
};
