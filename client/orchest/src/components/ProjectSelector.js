import React from "react";
import { MDCLinearProgressReact, MDCSelectReact } from "@lib/mdc";
import {
  makeCancelable,
  makeRequest,
  PromiseManager,
  RefManager,
} from "@lib/utils";
import ProjectsView from "../views/ProjectsView";

class ProjectSelector extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      projects: undefined,
    };

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
      // selected project doesn't exist anymore
      project_uuid = undefined;
    }

    this.onChangeProject(project_uuid);
  }

  fetchProjects() {
    let fetchProjectsPromise = makeCancelable(
      makeRequest("GET", "/async/projects?skip_discovery=true"),
      this.promiseManager
    );

    fetchProjectsPromise.promise.then((response) => {
      let projects = JSON.parse(response);

      // validate the currently selected project, if its invalid
      // it will be set to undefined
      let project_uuid = this.props.project_uuid;
      if (project_uuid !== undefined) {
        this.validatePreSelectedProject(project_uuid, projects);
      }

      // either there was no selected project or the selection
      // was invalid, set the selection to the first project if possible
      project_uuid = this.props.project_uuid;
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
      return (
        <MDCSelectReact
          label="Project"
          notched={true}
          classNames={["project-selector", "fullwidth"]}
          options={this.state.selectItems}
          onChange={this.onChangeProject.bind(this)}
          value={this.props.project_uuid}
        />
      );
    } else {
      return <MDCLinearProgressReact />;
    }
  }
}

export default ProjectSelector;
