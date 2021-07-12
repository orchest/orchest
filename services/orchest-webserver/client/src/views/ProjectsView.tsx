import * as React from "react";
import {
  MDCButtonReact,
  MDCDataTableReact,
  MDCDialogReact,
  MDCTextFieldReact,
  MDCIconButtonToggleReact,
  MDCLinearProgressReact,
} from "@orchest/lib-mdc";
import {
  makeRequest,
  makeCancelable,
  PromiseManager,
  RefManager,
  validURL,
} from "@orchest/lib-utils";
import { useOrchest } from "@/hooks/orchest";
import { BackgroundTaskPoller } from "@/utils/webserver-utils";
import { Layout } from "@/components/Layout";
import ProjectSettingsView from "@/views/ProjectSettingsView";
import PipelinesView from "@/views/PipelinesView";

const ERROR_MAPPING = {
  "project move failed": "failed to move project because the directory exists.",
  "project name contains illegal character":
    "project name contains illegal character(s).",
} as const;

const ProjectsView: React.FC<any> = (props) => {
  const { orchest } = window;

  const context = useOrchest();

  const [state, setState] = React.useState({
    createModal: false,
    showImportModal: false,
    loading: true,
    // import dialog
    import_url: "",
    import_project_name: "",
    // create dialog
    create_project_name: "",
    projects: null,
    listData: null,
    importResult: undefined,
    fetchListAndSetProject: "",
  });

  const [promiseManager] = React.useState(new PromiseManager());
  const [refManager] = React.useState(new RefManager());
  const [backgroundTaskPoller] = React.useState(new BackgroundTaskPoller());
  backgroundTaskPoller.POLL_FREQUENCY = 1000;

  const getMappedErrorMessage = (key) => {
    if (ERROR_MAPPING[key] !== undefined) {
      return ERROR_MAPPING[key];
    } else {
      return "undefined error. Please try again.";
    }
  };

  const conditionalShowImportFromURL = () => {
    if (props?.queryArgs?.import_url) {
      setState((prevState) => ({
        ...prevState,
        import_url: props.queryArgs.import_url,
        showImportModal: true,
      }));
    }
  };

  const processListData = (projects) => {
    let listData = [];

    for (let project of projects) {
      listData.push([
        <span>{project.path}</span>,
        <span>{project.pipeline_count}</span>,
        <span>{project.session_count}</span>,
        <span>{project.job_count}</span>,
        <span>{project.environment_count}</span>,
        <MDCIconButtonToggleReact
          icon={"settings"}
          onClick={() => {
            openSettings(project);
          }}
        />,
      ]);
    }

    return listData;
  };

  const fetchList = (fetchListAndSetProject?: string) => {
    // initialize REST call for pipelines
    let fetchListPromise = makeCancelable(
      makeRequest("GET", "/async/projects?session_counts=true&job_counts=true"),
      promiseManager
    );

    fetchListPromise.promise.then((response) => {
      let projects = JSON.parse(response);

      setState((prevState) => ({
        ...prevState,
        fetchListAndSetProject,
        listData: processListData(projects),
        projects: projects,
        loading: false,
      }));

      // Verify selected project UUID
      if (
        context.state.project_uuid !== undefined &&
        projects.filter((project) => project.uuid == context.state.project_uuid)
          .length == 0
      ) {
        context.dispatch({
          type: "projectSet",
          payload: projects.length > 0 ? projects[0].uuid : null,
        });
      }

      if (refManager.refs.projectListView) {
        refManager.refs.projectListView.setSelectedRowIds([]);
      }
    });
  };

  const openSettings = (project) => {
    orchest.loadView(ProjectSettingsView, {
      queryArgs: {
        project_uuid: project.uuid,
      },
    });
  };

  const onClickListItem = (row, idx, e) => {
    let project = state.projects[idx];
    context.dispatch({
      type: "projectSet",
      payload: project.uuid,
    });
    orchest.loadView(PipelinesView);
  };

  const onDeleteClick = () => {
    let selectedIndices = refManager.refs.projectListView.getSelectedRowIndices();

    if (selectedIndices.length === 0) {
      orchest.alert("Error", "You haven't selected a project.");
      return;
    }

    orchest.confirm(
      "Warning",
      "Are you certain that you want to delete this project? This will kill all associated resources and also delete all corresponding jobs. (This cannot be undone.)",
      () => {
        setState((prevState) => ({
          ...prevState,
          loading: true,
        }));

        let deletePromises = [];

        selectedIndices.forEach((index) => {
          let project_uuid = state.projects[index].uuid;
          deletePromises.push(deleteProjectRequest(project_uuid));
        });

        Promise.all(deletePromises).then(() => {
          fetchList();
        });
      }
    );
  };

  const deleteProjectRequest = (project_uuid) => {
    if (context.state.project_uuid == project_uuid) {
      context.dispatch({
        type: "projectSet",
        payload: null,
      });
    }

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
  };

  const onCreateClick = () => {
    setState((prevState) => ({
      ...prevState,
      createModal: true,
    }));
  };

  const onSubmitModal = () => {
    let projectName = state.create_project_name;

    if (projectName.length == 0) {
      orchest.alert("Error", "Project name cannot be empty.");
      return;
    }

    let projectNameValidation = validProjectName(projectName);
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
        fetchList(projectName);
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
        setState((prevState) => ({
          ...prevState,
          create_project_name: "",
        }));
      });

    setState((prevState) => ({
      ...prevState,
      createModal: false,
    }));
  };

  const validProjectName = (projectName) => {
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
  };

  const onSubmitImport = () => {
    let gitURL = state.import_url;
    let gitProjectName = state.import_project_name;

    if (!validURL(gitURL) || !gitURL.startsWith("https://")) {
      orchest.alert(
        "Error",
        "Please make sure you enter a valid HTTPS git-repo URL."
      );
      return;
    }

    let projectNameValidation = validProjectName(gitProjectName);
    if (!projectNameValidation.valid) {
      orchest.alert(
        "Error",
        "Please make sure you enter a valid project name. " +
          projectNameValidation.reason
      );
      return;
    }

    setState((prevState) => ({
      ...prevState,
      importResult: {
        status: "PENDING",
      },
    }));

    let jsonData = { url: gitURL };

    // only add project_name if use entered a value in the form
    if (gitProjectName.length > 0) {
      (jsonData as any).project_name = gitProjectName;
    }

    makeRequest("POST", `/async/projects/import-git`, {
      type: "json",
      content: jsonData,
    }).then((response: string) => {
      let data = JSON.parse(response);

      backgroundTaskPoller.startPollingBackgroundTask(data.uuid, (result) => {
        setState((prevState) => ({
          ...prevState,
          importResult: result,

          // This way the modal will not be reopened if it was closed
          // by the user.
          showImportModal:
            prevState.showImportModal && result.status != "SUCCESS",
        }));

        if (result.status == "SUCCESS") {
          setState((prevState) => ({
            ...prevState,
            import_project_name: "",
            import_url: "",
          }));
        }

        fetchList(result.status === "SUCCESS" ? result.result : undefined);
      });
    });
  };

  const onCancelModal = () => {
    refManager.refs.createProjectDialog.close();
  };

  const onCloseCreateProjectModal = () => {
    setState((prevState) => ({
      ...prevState,
      createModal: false,
    }));
  };

  const onCancelImport = () => {
    refManager.refs.importProjectDialog.close();
  };

  const onCloseImportProjectModal = () => {
    setState((prevState) => ({
      ...prevState,
      showImportModal: false,
      import_project_name: "",
      import_url: "",
    }));
  };

  const onImport = () => {
    setState((prevState) => ({
      ...prevState,
      importResult: undefined,
      showImportModal: true,
    }));
  };

  const handleChange = (key, value) => {
    let updateObj = {};
    updateObj[key] = value;
    setState((prevState) => ({ ...prevState, ...updateObj }));
  };

  React.useEffect(() => {
    fetchList();
    conditionalShowImportFromURL();

    return () => {
      promiseManager.cancelCancelablePromises();
      backgroundTaskPoller.removeAllTasks();
    };
  }, []);

  React.useEffect(() => {
    conditionalShowImportFromURL();
  }, [props?.queryArgs]);

  React.useEffect(() => {
    if (state.fetchListAndSetProject && state.fetchListAndSetProject !== "") {
      const createdProject = state.projects.filter((proj) => {
        return proj.path == state.fetchListAndSetProject;
      })[0];

      context.dispatch({
        type: "projectSet",
        payload: createdProject.uuid,
      });
    }
  }, [state?.fetchListAndSetProject]);

  return (
    <Layout>
      <div className={"view-page projects-view"}>
        {(() => {
          if (state.showImportModal) {
            return (
              <MDCDialogReact
                title="Import a project"
                onClose={onCloseImportProjectModal.bind(this)}
                ref={refManager.nrefs.importProjectDialog}
                content={
                  <div className="project-import-modal">
                    {props.queryArgs &&
                      props.queryArgs.import_url !== undefined && (
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
                      value={state.import_url}
                      onChange={handleChange.bind(this, "import_url")}
                    />

                    <MDCTextFieldReact
                      classNames={["fullwidth"]}
                      label="Project name (optional)"
                      value={state.import_project_name}
                      onChange={handleChange.bind(this, "import_project_name")}
                    />

                    {(() => {
                      if (state.importResult) {
                        let result;

                        if (state.importResult.status === "PENDING") {
                          result = <MDCLinearProgressReact />;
                        } else if (state.importResult.status === "FAILURE") {
                          result = (
                            <p>
                              <i className="material-icons float-left">error</i>{" "}
                              Import failed:{" "}
                              {getMappedErrorMessage(state.importResult.result)}
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
                  <React.Fragment>
                    <MDCButtonReact
                      icon="close"
                      label="Close"
                      classNames={["push-right"]}
                      onClick={onCancelImport.bind(this)}
                    />
                    <MDCButtonReact
                      icon="input"
                      // So that the button is disabled when in a states
                      // that requires so (currently ["PENDING"]).
                      disabled={["PENDING"].includes(
                        state.importResult !== undefined
                          ? state.importResult.status
                          : undefined
                      )}
                      classNames={["mdc-button--raised", "themed-secondary"]}
                      label="Import"
                      submitButton
                      onClick={onSubmitImport.bind(this)}
                    />
                  </React.Fragment>
                }
              />
            );
          }
        })()}

        {(() => {
          if (state.createModal) {
            return (
              <MDCDialogReact
                title="Create a new project"
                onClose={onCloseCreateProjectModal.bind(this)}
                ref={refManager.nrefs.createProjectDialog}
                content={
                  <MDCTextFieldReact
                    classNames={["fullwidth"]}
                    label="Project name"
                    value={state.create_project_name}
                    onChange={handleChange.bind(this, "create_project_name")}
                  />
                }
                actions={
                  <React.Fragment>
                    <MDCButtonReact
                      icon="close"
                      label="Cancel"
                      classNames={["push-right"]}
                      onClick={onCancelModal.bind(this)}
                    />
                    <MDCButtonReact
                      icon="format_list_bulleted"
                      classNames={["mdc-button--raised", "themed-secondary"]}
                      label="Create project"
                      submitButton
                      onClick={onSubmitModal.bind(this)}
                    />
                  </React.Fragment>
                }
              />
            );
          }
        })()}

        <h2>Projects</h2>

        {(() => {
          if (state.loading) {
            return <MDCLinearProgressReact />;
          } else {
            return (
              <React.Fragment>
                <div className="push-down">
                  <MDCButtonReact
                    classNames={[
                      "mdc-button--raised",
                      "themed-secondary",
                      "push-right",
                    ]}
                    icon="add"
                    label="Add project"
                    onClick={onCreateClick.bind(this)}
                  />
                  <MDCButtonReact
                    classNames={["mdc-button--raised"]}
                    icon="input"
                    label="Import project"
                    onClick={onImport.bind(this)}
                  />
                </div>
                <div className={"pipeline-actions push-down"}>
                  <MDCIconButtonToggleReact
                    icon="delete"
                    tooltipText="Delete project"
                    onClick={onDeleteClick.bind(this)}
                  />
                </div>

                <MDCDataTableReact
                  ref={refManager.nrefs.projectListView}
                  selectable
                  onRowClick={onClickListItem.bind(this)}
                  classNames={["fullwidth"]}
                  headers={[
                    "Project",
                    "Pipelines",
                    "Active sessions",
                    "Jobs",
                    "Environments",
                    "Settings",
                  ]}
                  rows={state.listData}
                />
              </React.Fragment>
            );
          }
        })()}
      </div>
    </Layout>
  );
};

export default ProjectsView;
