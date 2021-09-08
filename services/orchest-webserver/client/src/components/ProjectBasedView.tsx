import React from "react";
import { useHistory } from "react-router-dom";
import { MDCButtonReact } from "@orchest/lib-mdc";
import { siteMap } from "@/Routes";

export interface IProjectBasedViewProps {
  projectId?: string;
}

const ProjectBasedView: React.FC<IProjectBasedViewProps> = ({
  projectId,
  children,
}) => {
  const history = useHistory();

  const goToProjects = () => history.push(siteMap.projects.path);
  const message =
    "It looks like you don't have any projects yet! To get started using Orchest create your first project.";

  return (
    <div className="view-page">
      {projectId ? (
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
