import * as React from "react";
import { MDCButtonReact } from "@orchest/lib-mdc";
import ProjectsView from "@/views/ProjectsView";

export interface IProjectBasedViewProps {
  project_uuid?: string;
  childView?: any;
}

const ProjectBasedView: React.FC<IProjectBasedViewProps> = (props) => {
  const { orchest } = window;

  const TagName = props.childView;

  return (
    <div className="view-page">
      {props.project_uuid ? (
        <TagName project_uuid={props.project_uuid} key={props.project_uuid} />
      ) : (
        <div>
          <p className="push-down">
            It looks like you don't have any projects yet! To get started using
            Orchest create your first project.
          </p>
          <MDCButtonReact
            classNames={["mdc-button--raised", "themed-secondary"]}
            onClick={() => orchest.loadView(ProjectsView)}
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
