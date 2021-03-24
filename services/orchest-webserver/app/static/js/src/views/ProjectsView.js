import React, { Fragment } from "react";
import MDCButtonReact from "../lib/mdc-components/MDCButtonReact";
import MDCDataTableReact from "../lib/mdc-components/MDCDataTableReact";
import MDCDialogReact from "../lib/mdc-components/MDCDialogReact";
import MDCIconButtonToggleReact from "../lib/mdc-components/MDCIconButtonToggleReact";
import MDCLinearProgressReact from "../lib/mdc-components/MDCLinearProgressReact";
import MDCTextFieldReact from "../lib/mdc-components/MDCTextFieldReact";
import ProjectSettingsView from "./ProjectSettingsView";

import {
  makeRequest,
  makeCancelable,
  PromiseManager,
  RefManager,
  validURL,
} from "../lib/utils/all";
import { BackgroundTaskPoller } from "../utils/webserver-utils";
import PipelinesView from "./PipelinesView";

class ProjectsView extends React.Component {
  componentWillUnmount() {}

  constructor(props) {
    super(props);

    this.state = {
      createModal: false,
      showImportModal: false,
      loading: true,
      // import dialog
      import_url: "",
      import_project_name: "",
      // create dialog
      create_project_name: "",
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

  componentDidUpdate(prevProps) {
    if (
      this.props.queryArgs &&
      prevProps.queryArgs &&
      this.props.queryArgs.import_url != prevProps.queryArgs.import_url
    ) {
      this.conditionalShowImportFromURL();
    }
  }

  conditionalShowImportFromURL() {
    if (this.props.queryArgs && this.props.queryArgs.import_url) {
      this.setState({
        import_url: this.props.queryArgs.import_url,
        showImportModal: true,
      });
    }
  }

  componentDidMount() {
    this.fetchList();
    this.conditionalShowImportFromURL();
  }

  processListData(projects) {
    let listData = [];

    for (let project of projects) {
      console.log(project);
      listData.push([
        <span>{project.path}</span>,
        <span>{project.pipeline_count}</span>,
        <span>{project.session_count}</span>,
        <span>{project.job_count}</span>,
        <span>{project.environment_count}</span>,
        <MDCIconButtonToggleReact
          icon={"settings"}
          onClick={() => {
            this.openSettings(project);
          }}
        />,
      ]);
    }

    return listData;
  }

  fetchList() {
    // initialize REST call for pipelines
    let fetchListPromise = makeCancelable(
      makeRequest("GET", "/async/projects?session_counts=true&job_counts=true"),
      this.promiseManager
    );

    fetchListPromise.promise.then((response) => {
      let projects = JSON.parse(response);
      this.setState({
        listData: this.processListData(projects),
        projects: projects,
        loading: false,
      });

      orchest.invalidateProjects();

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
    let project = this.state.projects[idx];
    orchest.setProject(project.uuid);
    orchest.loadView(PipelinesView);
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
  }

  onSubmitModal() {
    let projectName = this.state.create_project_name;

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
      })
      .finally(() => {
        this.setState({
          create_project_name: "",
        });
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
    let gitURL = this.state.import_url;
    let gitProjectName = this.state.import_project_name;

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

  handleChange(key, value) {
    let updateObj = {};
    updateObj[key] = value;
    this.setState(updateObj);
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
                    {this.props.queryArgs &&
                      this.props.queryArgs.import_url !== undefined && (
                        <div className="push-down warning">
                          <p>
                            <i className="material-icons">warning</i> The import
                            URL was pre-filled. Make sure you trust the{" "}
                            <span className="code">git</span> repository you're
                            importing.
                          </p>
                        </div>
                      )}
                    <p className="push-down">
                      Import a <span className="code">git</span> repository by
                      specifying the <span className="code">HTTPS</span> URL
                      below:
                    </p>
                    <MDCTextFieldReact
                      classNames={["fullwidth push-down"]}
                      label="Git repository URL"
                      value={this.state.import_url}
                      onChange={this.handleChange.bind(this, "import_url")}
                    />

                    <MDCTextFieldReact
                      classNames={["fullwidth"]}
                      label="Project name (optional)"
                      value={this.state.import_project_name}
                      onChange={this.handleChange.bind(
                        this,
                        "import_project_name"
                      )}
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
                      icon="close"
                      label="Close"
                      classNames={["push-right"]}
                      onClick={this.onCancelImport.bind(this)}
                    />
                    <MDCButtonReact
                      icon="input"
                      // So that the button is disabled when in a states
                      // that requires so (currently ["PENDING"]).
                      disabled={["PENDING"].includes(
                        this.state.importResult !== undefined
                          ? this.state.importResult.status
                          : undefined
                      )}
                      classNames={["mdc-button--raised", "themed-secondary"]}
                      label="Import"
                      submitButton
                      onClick={this.onSubmitImport.bind(this)}
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
                    classNames={["fullwidth"]}
                    label="Project name"
                    value={this.state.create_project_name}
                    onChange={this.handleChange.bind(
                      this,
                      "create_project_name"
                    )}
                  />
                }
                actions={
                  <Fragment>
                    <MDCButtonReact
                      icon="close"
                      label="Cancel"
                      classNames={["push-right"]}
                      onClick={this.onCancelModal.bind(this)}
                    />
                    <MDCButtonReact
                      icon="format_list_bulleted"
                      classNames={["mdc-button--raised", "themed-secondary"]}
                      label="Create project"
                      submitButton
                      onClick={this.onSubmitModal.bind(this)}
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
                <div className="push-down">
                  <MDCButtonReact
                    classNames={[
                      "mdc-button--raised",
                      "themed-secondary",
                      "push-right",
                    ]}
                    icon="add"
                    label="Add project"
                    onClick={this.onCreateClick.bind(this)}
                  />
                  <MDCButtonReact
                    classNames={["mdc-button--raised"]}
                    icon="input"
                    label="Import project"
                    onClick={this.onImport.bind(this)}
                  />
                </div>
                <div className={"pipeline-actions push-down"}>
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
                  headers={[
                    "Project",
                    "Pipelines",
                    "Active sessions",
                    "Jobs",
                    "Environments",
                    "Settings",
                  ]}
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
