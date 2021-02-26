import React from "react";
import MDCButtonReact from "../lib/mdc-components/MDCButtonReact";
import MDCLinearProgressReact from "../lib/mdc-components/MDCLinearProgressReact";
import MDCSelectReact from "../lib/mdc-components/MDCSelectReact";
import {
  makeCancelable,
  makeRequest,
  PromiseManager,
  RefManager,
} from "../lib/utils/all";
import ProjectsView from "../views/ProjectsView";

class ProjectSelector extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      project_uuid: props.project_uuid,
    };

    if (this.state.project_uuid === undefined) {
      this.state.project_uuid = orchest.browserConfig.get(
        "selected_project_uuid"
      );
    }

    this.refManager = new RefManager();
    this.promiseManager = new PromiseManager();
  }

  componentDidMount() {
    this.fetchProjects();
  }

  listProcess(projects) {
    let options = [];

    for (let project of projects) {
      options.push([project.uuid, project.path]);
    }

    return options;
  }

  onChangeProject(project_uuid) {
    if (this.props.onChangeProject) {
      this.props.onChangeProject(project_uuid);
    }

    this.setState({
      project_uuid: project_uuid,
    });

    orchest.browserConfig.set("selected_project_uuid", project_uuid);
  }

  // check whether selected project is valid
  validatePreSelectedProject(project_uuid, projects) {
    let foundProjectUUID = false;

    for (let project of projects) {
      if (project.uuid === project_uuid) {
        foundProjectUUID = true;
        break;
      }
    }

    if (!foundProjectUUID) {
      orchest.browserConfig.remove("selected_project_uuid");
      this.setState({
        project_uuid: undefined,
      });
    } else {
      this.onChangeProject(project_uuid);
    }
  }

  fetchProjects() {
    let fetchProjectsPromise = makeCancelable(
      makeRequest("GET", "/async/projects"),
      this.promiseManager
    );

    fetchProjectsPromise.promise.then((response) => {
      let projects = JSON.parse(response);

      // validate the currently selected project, if its invalid
      // it will be set to undefined
      let project_uuid = this.state.project_uuid;
      if (project_uuid !== undefined) {
        this.validatePreSelectedProject(project_uuid, projects);
      }

      // either there was no selected project or the selection
      // was invalid, set the selection to the first project if possible
      project_uuid = this.state.project_uuid;
      if (project_uuid === undefined && projects.length > 0) {
        project_uuid = projects[0].uuid;
        this.onChangeProject(project_uuid);
      }

      this.setState({
        selectItems: this.listProcess(projects),
        projects: projects,
      });
    });
  }

  openProjects() {
    orchest.loadView(ProjectsView);
  }

  render() {
    if (this.state.projects) {
      if (this.state.project_uuid !== undefined) {
        return (
          <MDCSelectReact
            label="Project"
            classNames={["project-selector", "fullwidth"]}
            options={this.state.selectItems}
            onChange={this.onChangeProject.bind(this)}
            value={this.state.project_uuid}
          />
        );
      } else {
        return (
          <div>
            <p className="push-down">No projects found.</p>
            <MDCButtonReact
              classNames={["mdc-button--raised", "themed-secondary"]}
              label="Create your first project"
              onClick={this.openProjects.bind(this)}
            />
          </div>
        );
      }
    } else {
      return <MDCLinearProgressReact />;
    }
  }
}

export default ProjectSelector;
