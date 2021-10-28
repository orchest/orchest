import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/Routes";
import { MDCButtonReact } from "@orchest/lib-mdc";
import React from "react";

export interface IProjectBasedViewProps {
  projectUuid?: string;
}

const ProjectBasedView: React.FC<IProjectBasedViewProps> = ({
  projectUuid,
  children,
}) => {
  const { navigateTo } = useCustomRoute();

  const goToProjects = () => navigateTo(siteMap.projects.path);
  const message =
    "It looks like you don't have any projects yet! To get started using Orchest create your first project.";

  return (
    <div className="view-page">
      {projectUuid ? (
        children
      ) : (
        <div>
          <p className="push-down">{message}</p>
          <MDCButtonReact
            classNames={["mdc-button--raised", "themed-secondary"]}
            onClick={goToProjects}
            label="Create your first project!"
            icon="add"
            submitButton
          />
        </div>
      )}
    </div>
  );
};

export default ProjectBasedView;
