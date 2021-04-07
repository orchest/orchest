import React from "react";
import { MDCButtonReact } from "@lib/mdc";
import ProjectsView from "../views/ProjectsView";

class ProjectBasedView extends React.Component {
  constructor(props) {
    super(props);
  }

  projectsButtonHandler() {
    orchest.loadView(ProjectsView);
  }

  render() {
    let TagName = this.props.childView;

    return (
      <div className="view-page">
        {this.props.project_uuid ? (
          <TagName
            {...{
              ...this.props.childViewProps,
              ...{
                project_uuid: this.props.project_uuid,
                key: this.props.project_uuid,
              },
            }}
          />
        ) : (
          <div>
            <p className="push-down">
              It looks like you don't have any projects yet! To get started
              using Orchest create your first project.
            </p>
            <MDCButtonReact
              classNames={["mdc-button--raised", "themed-secondary"]}
              onClick={this.projectsButtonHandler.bind(this)}
              label="Create your first project!"
              icon="add"
              submitButton
            />
          </div>
        )}
      </div>
    );
  }
}

export default ProjectBasedView;
