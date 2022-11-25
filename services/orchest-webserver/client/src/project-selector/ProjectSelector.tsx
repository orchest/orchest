import React from "react";
import { ProjectSelectorMenu } from "./ProjectSelectorMenu";
import { ProjectSelectorToggle } from "./ProjectSelectorToggle";

export const ProjectSelector = () => {
  const [isOpen, setIsOpen] = React.useState(false);
  const toggle = React.useCallback(() => setIsOpen((current) => !current), []);

  return (
    <>
      <ProjectSelectorToggle onClick={toggle} tabIndex={0} isOpen={isOpen} />
      <ProjectSelectorMenu open={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
};
