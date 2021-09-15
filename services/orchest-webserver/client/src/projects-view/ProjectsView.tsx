import React from "react";

import {
  MDCButtonReact,
  MDCDataTableReact,
  MDCDialogReact,
  MDCIconButtonToggleReact,
  MDCLinearProgressReact,
  MDCTextFieldReact,
} from "@orchest/lib-mdc";
import {
  PromiseManager,
  RefManager,
  makeCancelable,
  makeRequest,
} from "@orchest/lib-utils";

import { Layout } from "@/components/Layout";
import { useOrchest } from "@/hooks/orchest";
import { siteMap } from "@/Routes";
import type { Project } from "@/types";
import { BackgroundTask, BackgroundTaskPoller } from "@/utils/webserver-utils";

import { useCustomRoute } from "@/hooks/useCustomRoute";

import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { ImportDialog } from "./ImportDialog";

const ProjectsView: React.FC = () => {
  const { orchest } = window;

  useSendAnalyticEvent("view load", { name: siteMap.projects.path });

  const context = useOrchest();
  const { navigateTo } = useCustomRoute();

  const [projectName, setProjectName] = React.useState<string>();
  const [isShowingCreateModal, setIsShowingCreateModal] = React.useState(false);

  const [isImporting, setIsImporting] = React.useState(false);

  const [state, setState] = React.useState({
    isDeleting: false,
    loading: true,
    projects: null,
    listData: null,
    importResult: undefined,
    fetchListAndSetProject: "",
    editProjectPathModal: false,
    editProjectPathModalBusy: false,
    editProjectPathUUID: undefined,
    editProjectPath: undefined,
  });

  const [promiseManager] = React.useState(new PromiseManager());
  const [refManager] = React.useState(new RefManager());
  const [backgroundTaskPoller] = React.useState(new BackgroundTaskPoller());
  backgroundTaskPoller.POLL_FREQUENCY = 1000;

  const onEditProjectName = (projectUUID, projectPath) => {
    setState((prevState) => ({
      ...prevState,
      editProjectPathUUID: projectUUID,
      editProjectPath: projectPath,
      editProjectPathModal: true,
    }));
  };

  const onCloseEditProjectPathModal = () => {
    setState((prevState) => ({
      ...prevState,
      editProjectPathModal: false,
      editProjectPathModalBusy: false,
    }));
  };

  const onSubmitEditProjectPathModal = () => {
    if (!validateProjectNameAndAlert(state.editProjectPath)) {
      return;
    }

    setState((prevState) => ({
      ...prevState,
      editProjectPathModalBusy: true,
    }));

    makeRequest("PUT", `/async/projects/${state.editProjectPathUUID}`, {
      type: "json",
      content: {
        name: state.editProjectPath,
      },
    })
      .then((_) => {
        fetchList();
      })
      .catch((e) => {
        try {
          let resp = JSON.parse(e.body);

          if (resp.code == 0) {
            orchest.alert(
              "Error",
              "Cannnot rename project when an interactive session is running."
            );
          } else if (resp.code == 1) {
            orchest.alert(
              "Error",
              'Cannnot rename project, a project with the name "' +
                state.editProjectPath +
                '" already exists.'
            );
          }
        } catch (error) {
          console.error(e);
          console.error(error);
        }
      })
      .finally(() => {
        onCloseEditProjectPathModal();
      });
  };

  const processListData = (projects: Project[]) => {
    return projects.map((project) => [
      <span key="toggle-row" className="mdc-icon-table-wrapper">
        {project.path}{" "}
        <span className="consume-click">
          <MDCIconButtonToggleReact
            icon="edit"
            onClick={() => {
              onEditProjectName(project.uuid, project.path);
            }}
          />
        </span>
      </span>,
      <span key="pipeline-count">{project.pipeline_count}</span>,
      <span key="session-count">{project.session_count}</span>,
      <span key="job-count">{project.job_count}</span>,
      <span key="env-count">{project.environment_count}</span>,
      <span key="setting" className="consume-click">
        <MDCIconButtonToggleReact
          icon={"settings"}
          onClick={() => {
            openSettings(project);
          }}
          data-test-id={`settings-button-${project.path}`}
        />
      </span>,
    ]);
  };

  const fetchList = (fetchListAndSetProject?: string) => {
    // initialize REST call for pipelines
    let fetchListPromise = makeCancelable(
      makeRequest("GET", "/async/projects?session_counts=true&job_counts=true"),
      promiseManager
    );

    fetchListPromise.promise
      .then((response: string) => {
        let projects: Project[] = JSON.parse(response);

        context.dispatch({
          type: "projectsSet",
          payload: projects,
        });

        setState((prevState) => ({
          ...prevState,
          fetchListAndSetProject,
          listData: processListData(projects),
          projects: projects,
          loading: false,
        }));

        // Verify selected project UUID
        // TODO: do we still need this?
        if (
          !context.state.projectUuid ||
          !projects.some(
            (project) => project.uuid === context.state.projectUuid
          )
        ) {
          context.dispatch({
            type: "projectSet",
            payload: projects.length > 0 ? projects[0].uuid : null,
          });
        }

        if (refManager.refs.projectListView) {
          refManager.refs.projectListView.setSelectedRowIds([]);
        }
      })
      .catch(console.log);
  };

  const openSettings = (project: Project) => {
    navigateTo(siteMap.projectSettings.path, {
      query: { projectUuid: project.uuid },
    });
  };

  const onClickListItem = (row, idx, e) => {
    let project = state.projects[idx];

    navigateTo(siteMap.pipelines.path, {
      query: { projectUuid: project.uuid },
    });
  };

  const onDeleteClick = () => {
    if (!state.isDeleting) {
      setState((prevState) => ({
        ...prevState,
        isDeleting: true,
      }));

      let selectedIndices = refManager.refs.projectListView.getSelectedRowIndices();

      if (selectedIndices.length === 0) {
        orchest.alert("Error", "You haven't selected a project.");

        setState((prevState) => ({
          ...prevState,
          isDeleting: false,
        }));

        return;
      }

      orchest.confirm(
        "Warning",
        "Are you certain that you want to delete this project? This will kill all associated resources and also delete all corresponding jobs. (This cannot be undone.)",
        () => {
          // Start actual delete
          let deletePromises = [];

          selectedIndices.forEach((index) => {
            let project_uuid = state.projects[index].uuid;
            deletePromises.push(deleteProjectRequest(project_uuid));
          });

          Promise.all(deletePromises).then(() => {
            fetchList();

            // Clear isDeleting
            setState((prevState) => ({
              ...prevState,
              isDeleting: false,
            }));
          });
        },
        () => {
          setState((prevState) => ({
            ...prevState,
            isDeleting: false,
          }));
        }
      );
    } else {
      console.error("Delete UI in progress.");
    }
  };

  const deleteProjectRequest = (projectUuid) => {
    if (context.state.projectUuid === projectUuid) {
      context.dispatch({
        type: "projectSet",
        payload: null,
      });
    }

    let deletePromise = makeRequest("DELETE", "/async/projects", {
      type: "json",
      content: {
        project_uuid: projectUuid,
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
    setIsShowingCreateModal(true);
  };

  const goToExamples = () => {
    navigateTo(siteMap.examples.path);
  };

  const onClickCreateProject = () => {
    if (!validateProjectNameAndAlert(projectName)) {
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
        setProjectName("");
      });

    setIsShowingCreateModal(false);
  };

  const validProjectName = (projectName) => {
    if (projectName === undefined || projectName.length == 0) {
      return {
        valid: false,
        reason: "Project name cannot be empty.",
      };
    } else if (projectName.match("[^A-Za-z0-9_.-]")) {
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

  const validateProjectNameAndAlert = (projectName) => {
    let projectNameValidation = validProjectName(projectName);
    if (!projectNameValidation.valid) {
      orchest.alert(
        "Error",
        "Please make sure you enter a valid project name. " +
          projectNameValidation.reason
      );
    }
    return projectNameValidation.valid;
  };

  const onCancelModal = () => {
    refManager.refs.createProjectDialog.close();
  };

  const onCloseCreateProjectModal = () => {
    setIsShowingCreateModal(false);
  };

  const onImport = () => {
    setIsImporting(true);
  };

  const onImportComplete = (result: BackgroundTask) => {
    if (result.status === "SUCCESS") fetchList(result.result);
  };

  React.useEffect(() => {
    fetchList();

    return () => {
      promiseManager.cancelCancelablePromises();
      backgroundTaskPoller.removeAllTasks();
    };
  }, []);

  React.useEffect(() => {
    if (state.fetchListAndSetProject && state.fetchListAndSetProject !== "") {
      const createdProject = state.projects.filter((proj) => {
        return proj.path == state.fetchListAndSetProject;
      })[0];

      // Needed to avoid a race condition where the project does not
      // exist anymore because it has been removed between a POST and a
      // get request.
      if (createdProject !== undefined) {
        context.dispatch({
          type: "projectSet",
          payload: createdProject.uuid,
        });
      }
    }
  }, [state?.fetchListAndSetProject]);

  return (
    <Layout>
      <div className={"view-page projects-view"}>
        {isImporting && (
          <ImportDialog
            projectName={projectName}
            setProjectName={setProjectName}
            onImportComplete={onImportComplete}
            setShouldOpen={setIsImporting}
          />
        )}

        {state.editProjectPathModal && (
          <MDCDialogReact
            title="Edit project name"
            onClose={onCloseEditProjectPathModal}
            content={
              <React.Fragment>
                <MDCTextFieldReact
                  classNames={["fullwidth push-down"]}
                  value={state.editProjectPath}
                  label="Project name"
                  onChange={(value) => {
                    setState((prevState) => ({
                      ...prevState,
                      editProjectPath: value,
                    }));
                  }}
                />
              </React.Fragment>
            }
            actions={
              <React.Fragment>
                <MDCButtonReact
                  icon="close"
                  label="Cancel"
                  classNames={["push-right"]}
                  onClick={onCloseEditProjectPathModal}
                />
                <MDCButtonReact
                  icon="save"
                  disabled={state.editProjectPathModalBusy}
                  classNames={["mdc-button--raised", "themed-secondary"]}
                  label="Save"
                  submitButton
                  onClick={onSubmitEditProjectPathModal}
                />
              </React.Fragment>
            }
          />
        )}

        {(() => {
          if (isShowingCreateModal) {
            return (
              <MDCDialogReact
                title="Create a new project"
                onClose={onCloseCreateProjectModal}
                ref={refManager.nrefs.createProjectDialog}
                content={
                  <MDCTextFieldReact
                    classNames={["fullwidth"]}
                    label="Project name"
                    value={projectName}
                    onChange={setProjectName}
                    data-test-id="project-name-textfield"
                  />
                }
                actions={
                  <React.Fragment>
                    <MDCButtonReact
                      icon="close"
                      label="Cancel"
                      classNames={["push-right"]}
                      onClick={onCancelModal}
                    />
                    <MDCButtonReact
                      icon="format_list_bulleted"
                      classNames={["mdc-button--raised", "themed-secondary"]}
                      label="Create project"
                      submitButton
                      onClick={onClickCreateProject}
                      data-test-id="create-project"
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
                    onClick={onCreateClick}
                    data-test-id="add-project"
                  />
                  <MDCButtonReact
                    classNames={["mdc-button--raised", "push-right"]}
                    icon="input"
                    label="Import project"
                    onClick={onImport}
                    data-test-id="import-project"
                  />
                  <MDCButtonReact
                    classNames={["mdc-button--raised"]}
                    icon="lightbulb"
                    label="Explore Examples"
                    onClick={goToExamples}
                    data-test-id="explore-examples"
                  />
                </div>
                <div className={"pipeline-actions push-down"}>
                  <MDCIconButtonToggleReact
                    icon="delete"
                    disabled={state.isDeleting}
                    tooltipText="Delete project"
                    onClick={onDeleteClick}
                    data-test-id="delete-project"
                  />
                </div>

                <MDCDataTableReact
                  ref={refManager.nrefs.projectListView}
                  selectable
                  onRowClick={onClickListItem}
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
                  data-test-id="projects-table"
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
