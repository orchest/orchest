import React, { Fragment } from "react";
import MDCButtonReact from "../lib/mdc-components/MDCButtonReact";
import MDCDataTableReact from "../lib/mdc-components/MDCDataTableReact";
import MDCDialogReact from "../lib/mdc-components/MDCDialogReact";
import MDCIconButtonToggleReact from "../lib/mdc-components/MDCIconButtonToggleReact";
import MDCLinearProgressReact from "../lib/mdc-components/MDCLinearProgressReact";
import MDCTextFieldReact from "../lib/mdc-components/MDCTextFieldReact";
import JobsView from "./JobsView";
import PipelinesView from "./PipelinesView";
import ProjectSettingsView from "./ProjectSettingsView";
import EnvironmentsView from "./EnvironmentsView";

import {
  makeRequest,
  makeCancelable,
  PromiseManager,
  RefManager,
  validURL,
} from "../lib/utils/all";
import { BackgroundTaskPoller } from "../utils/webserver-utils";

class ProjectsView extends React.Component {
  componentWillUnmount() {}

  constructor(props) {
    super(props);

    this.state = {
      createModal: false,
      showImportModal: false,
      loading: true,
    };

    this.ERROR_MAPPING = {
      "project move failed":
        "failed to move project because the directory exists.",
      "project name contains illegal character":
        "project name contains illegal character(s).",
    };

    this.promiseManager = new PromiseManager();
    this.refManager = new RefManager();
    this.backgroundTaskPoller = new BackgroundTaskPoller();
    this.backgroundTaskPoller.POLL_FREQUENCY = 1000;
  }

  getMappedErrorMessage(key) {
    if (this.ERROR_MAPPING[key] !== undefined) {
      return this.ERROR_MAPPING[key];
    } else {
      return "undefined error. Please try again.";
    }
  }

  componentWillUnmount() {
    this.promiseManager.cancelCancelablePromises();
    this.backgroundTaskPoller.removeAllTasks();
  }

  componentDidMount() {
    this.fetchList();
  }

  onClickProjectEntity(view, project, e) {
    e.preventDefault();
    orchest.browserConfig.set("selected_project_uuid", project.uuid);
    orchest.loadView(view);
  }

  processListData(projects) {
    let listData = [];

    for (let project of projects) {
      listData.push([
        <span>{project.path}</span>,
        <MDCButtonReact
          onClick={this.onClickProjectEntity.bind(this, PipelinesView, project)}
          label={project.pipeline_count}
        />,
        <MDCButtonReact
          onClick={this.onClickProjectEntity.bind(this, JobsView, project)}
          label={project.job_count}
        />,
        <MDCButtonReact
          onClick={this.onClickProjectEntity.bind(
            this,
            EnvironmentsView,
            project
          )}
          label={project.environment_count}
        />,
      ]);
    }

    return listData;
  }

  fetchList() {
    // initialize REST call for pipelines
    let fetchListPromise = makeCancelable(
      makeRequest("GET", "/async/projects"),
      this.promiseManager
    );

    fetchListPromise.promise.then((response) => {
      let projects = JSON.parse(response);
      this.setState({
        listData: this.processListData(projects),
        projects: projects,
        loading: false,
      });
      if (this.refManager.refs.projectListView) {
        this.refManager.refs.projectListView.setSelectedRowIds([]);
      }
    });
  }

  openSettings(project) {
    orchest.loadView(ProjectSettingsView, {
      queryArgs: {
        project_uuid: project.uuid,
      },
    });
  }

  onClickListItem(row, idx, e) {
    if ($(e.target).parents(".mdc-button").length === 0) {
      let project = this.state.projects[idx];
      orchest.browserConfig.set("selected_project_uuid", project.uuid);
      this.openSettings(project);
    }
  }

  onDeleteClick() {
    let selectedIndices = this.refManager.refs.projectListView.getSelectedRowIndices();

    if (selectedIndices.length === 0) {
      orchest.alert("Error", "You haven't selected a project.");
      return;
    }

    orchest.confirm(
      "Warning",
      "Are you certain that you want to delete this project? This will kill all associated resources and also delete all corresponding jobs. (This cannot be undone.)",
      () => {
        this.setState({
          loading: true,
        });

        let deletePromises = [];

        selectedIndices.forEach((index) => {
          let project_uuid = this.state.projects[index].uuid;
          deletePromises.push(this.deleteProjectRequest(project_uuid));
        });

        Promise.all(deletePromises).then(() => {
          this.fetchList();
        });
      }
    );
  }

  deleteProjectRequest(project_uuid) {
    let deletePromise = makeRequest("DELETE", "/async/projects", {
      type: "json",
      content: {
        project_uuid: project_uuid,
      },
    });

    deletePromise.catch((response) => {
      try {
        let data = JSON.parse(response.body);

        orchest.alert("Error", "Could not delete project. " + data.message);
      } catch {
        orchest.alert("Error", "Could not delete project. Reason unknown.");
      }
    });

    return deletePromise;
  }

  onCreateClick() {
    this.setState({
      createModal: true,
    });

    this.refManager.refs.createProjectNameTextField.focus();
  }

  onSubmitModal() {
    let projectName = this.refManager.refs.createProjectNameTextField.mdc.value;

    if (projectName.length == 0) {
      orchest.alert("Error", "Project name cannot be empty.");
      return;
    }

    let projectNameValidation = this.validProjectName(projectName);
    if (!projectNameValidation.valid) {
      orchest.alert(
        "Error",
        "Please make sure you enter a valid project name. " +
          projectNameValidation.reason
      );
      return;
    }

    makeRequest("POST", "/async/projects", {
      type: "json",
      content: {
        name: projectName,
      },
    })
      .then((_) => {
        // reload list once creation succeeds
        this.fetchList();
      })
      .catch((response) => {
        try {
          let data = JSON.parse(response.body);

          orchest.alert("Error", "Could not create project. " + data.message);
        } catch {
          orchest.alert("Error", "Could not create project. Reason unknown.");
        }
      });

    this.setState({
      createModal: false,
    });
  }

  validProjectName(projectName) {
    if (projectName.match("[^A-Za-z0-9_.-]")) {
      return {
        valid: false,
        reason:
          "A project name has to be a valid git repository name and" +
          " thus can only contain alphabetic characters, numbers and" +
          " the special characters: '_.-'. The regex would be" +
          " [A-Za-z0-9_.-].",
      };
    }
    return { valid: true };
  }

  onSubmitImport() {
    let gitURL = this.refManager.refs.gitURLTextField.mdc.value;
    let gitProjectName = this.refManager.refs.gitProjectNameTextField.mdc.value;

    if (!validURL(gitURL) || !gitURL.startsWith("https://")) {
      orchest.alert(
        "Error",
        "Please make sure you enter a valid HTTPS git-repo URL."
      );
      return;
    }

    let projectNameValidation = this.validProjectName(gitProjectName);
    if (!projectNameValidation.valid) {
      orchest.alert(
        "Error",
        "Please make sure you enter a valid project name. " +
          projectNameValidation.reason
      );
      return;
    }

    this.setState({
      importResult: {
        status: "PENDING",
      },
    });

    let jsonData = { url: gitURL };

    // only add project_name if use entered a value in the form
    if (gitProjectName.length > 0) {
      jsonData.project_name = gitProjectName;
    }

    makeRequest("POST", `/async/projects/import-git`, {
      type: "json",
      content: jsonData,
    }).then((response) => {
      let data = JSON.parse(response);

      this.backgroundTaskPoller.startPollingBackgroundTask(
        data.uuid,
        (result) => {
          this.setState({
            importResult: result,
            // This way the modal will not be reopened if it was closed
            // by the user.
            showImportModal:
              this.state.showImportModal && result.status !== "SUCCESS",
          });
          this.fetchList();
        }
      );
    });
  }

  onCancelModal() {
    this.refManager.refs.createProjectDialog.close();
  }

  onCloseCreateProjectModal() {
    this.setState({
      createModal: false,
    });
  }

  onCancelImport() {
    this.refManager.refs.importProjectDialog.close();
  }

  onCloseImportProjectModal() {
    this.setState({
      showImportModal: false,
    });
  }

  onImport() {
    this.setState({
      importResult: undefined,
      showImportModal: true,
    });
  }

  render() {
    return (
      <div className={"view-page projects-view"}>
        {(() => {
          if (this.state.showImportModal) {
            return (
              <MDCDialogReact
                title="Import a project"
                onClose={this.onCloseImportProjectModal.bind(this)}
                ref={this.refManager.nrefs.importProjectDialog}
                content={
                  <div className="project-import-modal">
                    <p className="push-down">
                      Import a <span className="code">git</span> repository by
                      specifying the <span className="code">HTTPS</span> URL
                      below:
                    </p>
                    <MDCTextFieldReact
                      classNames={["fullwidth push-down"]}
                      label="Git repository URL"
                      ref={this.refManager.nrefs.gitURLTextField}
                    />

                    <MDCTextFieldReact
                      classNames={["fullwidth"]}
                      label="Project name (optional)"
                      ref={this.refManager.nrefs.gitProjectNameTextField}
                    />

                    {(() => {
                      if (this.state.importResult) {
                        let result;

                        if (this.state.importResult.status === "PENDING") {
                          result = <MDCLinearProgressReact />;
                        } else if (
                          this.state.importResult.status === "FAILURE"
                        ) {
                          result = (
                            <p>
                              <i className="material-icons float-left">error</i>{" "}
                              Import failed:{" "}
                              {this.getMappedErrorMessage(
                                this.state.importResult.result
                              )}
                            </p>
                          );
                        }

                        return <div className="push-up">{result}</div>;
                      }
                    })()}
                    <p className="push-up">
                      To import <b>private </b>
                      <span className="code">git</span> repositories upload them
                      directly through the File Manager into the{" "}
                      <span className="code">projects/</span> directory.
                    </p>
                  </div>
                }
                actions={
                  <Fragment>
                    <MDCButtonReact
                      icon="input"
                      disabled={this.state.importResult !== undefined}
                      classNames={["mdc-button--raised", "themed-secondary"]}
                      label="Import"
                      submitButton
                      onClick={this.onSubmitImport.bind(this)}
                    />
                    <MDCButtonReact
                      icon="close"
                      label="Close"
                      classNames={["push-left"]}
                      onClick={this.onCancelImport.bind(this)}
                    />
                  </Fragment>
                }
              />
            );
          }
        })()}

        {(() => {
          if (this.state.createModal) {
            return (
              <MDCDialogReact
                title="Create a new project"
                onClose={this.onCloseCreateProjectModal.bind(this)}
                ref={this.refManager.nrefs.createProjectDialog}
                content={
                  <MDCTextFieldReact
                    ref={this.refManager.nrefs.createProjectNameTextField}
                    classNames={["fullwidth"]}
                    label="Project name"
                  />
                }
                actions={
                  <Fragment>
                    <MDCButtonReact
                      icon="format_list_bulleted"
                      classNames={["mdc-button--raised", "themed-secondary"]}
                      label="Create project"
                      submitButton
                      onClick={this.onSubmitModal.bind(this)}
                    />
                    <MDCButtonReact
                      icon="close"
                      label="Cancel"
                      classNames={["push-left"]}
                      onClick={this.onCancelModal.bind(this)}
                    />
                  </Fragment>
                }
              />
            );
          }
        })()}

        <h2>Projects</h2>

        {(() => {
          if (this.state.loading) {
            return <MDCLinearProgressReact />;
          } else {
            return (
              <Fragment>
                <div className={"pipeline-actions push-down"}>
                  <MDCIconButtonToggleReact
                    icon="add"
                    tooltipText="Add project"
                    onClick={this.onCreateClick.bind(this)}
                  />
                  <MDCIconButtonToggleReact
                    icon="input"
                    tooltipText="Import project"
                    onClick={this.onImport.bind(this)}
                  />
                  <MDCIconButtonToggleReact
                    icon="delete"
                    tooltipText="Delete project"
                    onClick={this.onDeleteClick.bind(this)}
                  />
                </div>

                <MDCDataTableReact
                  ref={this.refManager.nrefs.projectListView}
                  selectable
                  onRowClick={this.onClickListItem.bind(this)}
                  classNames={["fullwidth"]}
                  headers={["Project", "Pipelines", "Jobs", "Environments"]}
                  rows={this.state.listData}
                />
              </Fragment>
            );
          }
        })()}
      </div>
    );
  }
}

export default ProjectsView;
