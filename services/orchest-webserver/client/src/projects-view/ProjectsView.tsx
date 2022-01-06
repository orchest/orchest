import { IconButton } from "@/components/common/IconButton";
import {
  DataTable,
  DataTableColumn,
  DataTableRow,
} from "@/components/DataTable";
import { Layout } from "@/components/Layout";
import { useAppContext } from "@/contexts/AppContext";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useImportUrl } from "@/hooks/useImportUrl";
import { useMounted } from "@/hooks/useMounted";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { siteMap } from "@/Routes";
import type { Project } from "@/types";
import { BackgroundTask } from "@/utils/webserver-utils";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import InputIcon from "@mui/icons-material/Input";
import LightbulbIcon from "@mui/icons-material/Lightbulb";
import SaveIcon from "@mui/icons-material/Save";
import SettingsIcon from "@mui/icons-material/Settings";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { fetcher, hasValue, makeRequest } from "@orchest/lib-utils";
import React from "react";
import useSWR from "swr";
import { ImportDialog } from "./ImportDialog";

type ProjectRow = Pick<
  Project,
  | "path"
  | "pipeline_count"
  | "session_count"
  | "job_count"
  | "environment_count"
> & {
  settings: string;
};

const ProjectsView: React.FC = () => {
  const { setAlert, setConfirm } = useAppContext();
  useSendAnalyticEvent("view load", { name: siteMap.projects.path });

  const {
    dispatch,
    state: { projectUuid },
  } = useProjectsContext();
  const { navigateTo } = useCustomRoute();

  const [projectName, setProjectName] = React.useState<string>();
  const [isShowingCreateModal, setIsShowingCreateModal] = React.useState(false);

  const [editProjectPathUuid, setEditProjectPathUuid] = React.useState<
    string | undefined
  >();
  const [projectPath, setProjectPath] = React.useState<string | undefined>();

  const [isUpdatingProjectPath, setIsUpdatingProjectPath] = React.useState(
    false
  );
  const [isImporting, setIsImporting] = React.useState(false);

  const columns: DataTableColumn<ProjectRow>[] = React.useMemo(() => {
    const openSettings = (projectUuid: string) => {
      navigateTo(siteMap.projectSettings.path, {
        query: { projectUuid },
      });
    };
    const onEditProjectName = (
      projectUUID: string,
      projectPathToBeEdited: string
    ) => {
      setEditProjectPathUuid(projectUUID);
      setProjectPath(projectPathToBeEdited);
    };
    return [
      {
        id: "path",
        label: "Project",
        render: function ProjectPath(row, disabled) {
          return (
            <Stack
              direction="row"
              alignItems="center"
              component="span"
              sx={{
                display: "inline-flex",
                button: { visibility: "hidden" },
                "&:hover": {
                  button: { visibility: "visible" },
                },
              }}
            >
              {row.path}
              <IconButton
                title="Edit job name"
                size="small"
                sx={{ marginLeft: (theme) => theme.spacing(2) }}
                disabled={disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  onEditProjectName(row.uuid, row.path);
                }}
              >
                <EditIcon />
              </IconButton>
            </Stack>
          );
        },
      },
      { id: "pipeline_count", label: "Pipelines" },
      { id: "session_count", label: "Active sessions" },
      { id: "job_count", label: "Jobs" },
      { id: "environment_count", label: "Environments" },
      {
        id: "settings",
        label: "Settings",
        render: function ProjectSettingsButton(row, disabled) {
          return (
            <IconButton
              title="settings"
              disabled={disabled}
              data-test-id={`settings-button-${row.path}`}
              onClick={(e) => {
                e.stopPropagation();
                openSettings(row.uuid);
              }}
            >
              <SettingsIcon />
            </IconButton>
          );
        },
      },
    ];
  }, [setProjectPath, navigateTo]);

  const onCloseEditProjectPathModal = () => {
    setEditProjectPathUuid(undefined);
    setIsUpdatingProjectPath(false);
  };

  const onSubmitEditProjectPathModal = () => {
    if (!validateProjectNameAndAlert(projectPath)) {
      return;
    }
    setIsUpdatingProjectPath(true);

    makeRequest("PUT", `/async/projects/${editProjectPathUuid}`, {
      type: "json",
      content: {
        name: projectPath,
      },
    })
      .then(() => {
        fetchProjects();
      })
      .catch((e) => {
        try {
          let resp = JSON.parse(e.body);

          if (resp.code == 0) {
            setAlert(
              "Error",
              "Cannot rename project when an interactive session is running."
            );
          } else if (resp.code == 1) {
            setAlert(
              "Error",
              `Cannot rename project, a project with the name "${projectPath}" already exists.`
            );
          }
        } catch (error) {
          console.error(error);
        }
      })
      .finally(() => {
        onCloseEditProjectPathModal();
      });
  };

  const {
    data: projects = [],
    revalidate: fetchProjects,
    error: fetchProjectsError,
    isValidating,
  } = useSWR<Project[]>(
    "/async/projects?session_counts=true&job_counts=true",
    fetcher
  );

  const mounted = useMounted();

  React.useEffect(() => {
    if (mounted && fetchProjectsError)
      setAlert("Error", "Error fetching projects");
  }, [fetchProjectsError]);

  React.useEffect(() => {
    if (mounted && !isValidating && !fetchProjectsError && projects) {
      dispatch({
        type: "projectsSet",
        payload: projects,
      });
    }
  }, [projects]);

  const projectRows: DataTableRow<ProjectRow>[] = React.useMemo(() => {
    return projects.map((project) => {
      return {
        ...project,
        settings: project.path,
      };
    });
  }, [projects]);

  const onRowClick = (projectUuid: string) => {
    navigateTo(siteMap.pipelines.path, {
      query: { projectUuid },
    });
  };

  const deleteSelectedRows = async (projectUuids: string[]) => {
    if (projectUuids.length === 0) {
      setAlert("Error", "You haven't selected a project.");

      return false;
    }

    // setConfirm returns a Promise, which is then passed to DataTable deleteSelectedRows function
    // DataTable then is able to act upon the outcome of the deletion operation
    return setConfirm(
      "Warning",
      "Are you certain that you want to delete these projects? This will kill all associated resources and also delete all corresponding jobs. (This cannot be undone.)",
      async (resolve) => {
        // we don't await this Promise on purpose
        // because we want the dialog close first, and resolve setConfirm later
        Promise.all(
          projectUuids.map((projectUuid) => deleteProjectRequest(projectUuid))
        )
          .then(() => {
            fetchProjects();
            resolve(true); // 2. this is resolved later, and this resolves the Promise returned by setConfirm, and thereafter resolved in DataTable
          })
          .catch(() => {
            resolve(false);
          });
        return true; // 1. this is resolved first, thus, the dialog will be gone once user click CONFIRM
      }
    );
  };

  const deleteProjectRequest = (toBeDeletedId: string) => {
    if (projectUuid === toBeDeletedId) {
      dispatch({
        type: "projectSet",
        payload: undefined,
      });
    }

    let deletePromise = makeRequest("DELETE", "/async/projects", {
      type: "json",
      content: {
        project_uuid: toBeDeletedId,
      },
    });

    deletePromise.catch((response) => {
      try {
        let data = JSON.parse(response.body);

        setAlert("Error", `Could not delete project. ${data.message}`);
      } catch {
        setAlert("Error", "Could not delete project. Reason unknown.");
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
      content: { name: projectName },
    })
      .then((_) => {
        // reload list once creation succeeds
        // fetchList(projectName);
        fetchProjects();
      })
      .catch((response) => {
        try {
          let data = JSON.parse(response.body);

          setAlert("Error", `Could not create project. ${data.message}`);
        } catch {
          setAlert("Error", "Could not create project. Reason unknown.");
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

  const validateProjectNameAndAlert = (projectName: string) => {
    let projectNameValidation = validProjectName(projectName);
    if (!projectNameValidation.valid) {
      setAlert(
        "Error",
        `Please make sure you enter a valid project name. ${projectNameValidation.reason}`
      );
    }
    return projectNameValidation.valid;
  };

  const onCloseCreateProjectModal = () => {
    setIsShowingCreateModal(false);
    setProjectName("");
  };

  const onImport = () => {
    setIsImporting(true);
  };

  const onImportComplete = (result: BackgroundTask) => {
    if (result.status === "SUCCESS") {
      fetchProjects();
    }
  };

  const [importUrl, setImportUrl] = useImportUrl();
  // if user loads the app with a pre-filled import_url in their query string
  // we prompt them directly with the import modal
  React.useEffect(() => {
    if (importUrl !== "") setIsImporting(true);
  }, [importUrl]);

  return (
    <Layout>
      <div className={"view-page projects-view"}>
        <ImportDialog
          projectName={projectName}
          setProjectName={setProjectName}
          onImportComplete={onImportComplete}
          importUrl={importUrl}
          setImportUrl={setImportUrl}
          open={isImporting}
          onClose={() => setIsImporting(false)}
        />
        <Dialog
          fullWidth
          maxWidth="xs"
          open={hasValue(editProjectPathUuid)}
          onClose={onCloseEditProjectPathModal}
        >
          <form
            id="edit-name"
            onSubmit={(e) => {
              e.preventDefault();
              onSubmitEditProjectPathModal();
            }}
          >
            <DialogTitle>Edit project name</DialogTitle>
            <DialogContent>
              <TextField
                fullWidth
                autoFocus
                sx={{ marginTop: (theme) => theme.spacing(2) }}
                value={projectPath}
                label="Project name"
                onChange={(e) => {
                  setProjectPath(e.target.value);
                }}
              />
            </DialogContent>
            <DialogActions>
              <Button
                color="secondary"
                startIcon={<CloseIcon />}
                onClick={onCloseEditProjectPathModal}
              >
                Cancel
              </Button>
              <Button
                startIcon={<SaveIcon />}
                variant="contained"
                disabled={isUpdatingProjectPath}
                type="submit"
                form="edit-name"
              >
                Save
              </Button>
            </DialogActions>
          </form>
        </Dialog>
        <Dialog
          open={isShowingCreateModal}
          onClose={onCloseCreateProjectModal}
          fullWidth
          maxWidth="xs"
        >
          <form
            id="create-project"
            onSubmit={(e) => {
              e.preventDefault();
              onClickCreateProject();
            }}
          >
            <DialogTitle>Create a new project</DialogTitle>
            <DialogContent>
              <TextField
                fullWidth
                autoFocus
                sx={{ marginTop: (theme) => theme.spacing(2) }}
                label="Project name"
                value={projectName}
                onChange={(e) =>
                  setProjectName(e.target.value.replace(/[^\w\.]/g, "-"))
                }
                data-test-id="project-name-textfield"
              />
            </DialogContent>
            <DialogActions>
              <Button
                startIcon={<CloseIcon />}
                color="secondary"
                onClick={onCloseCreateProjectModal}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                startIcon={<FormatListBulletedIcon />}
                type="submit"
                form="create-project"
                data-test-id="create-project"
              >
                Create project
              </Button>
            </DialogActions>
          </form>
        </Dialog>

        <h2>Projects</h2>
        {projectRows.length === 0 && isValidating ? (
          <LinearProgress />
        ) : (
          <>
            <Stack
              direction="row"
              spacing={2}
              sx={{ margin: (theme) => theme.spacing(2, 0) }}
            >
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={onCreateClick}
                data-test-id="add-project"
              >
                Create project
              </Button>
              <Button
                variant="contained"
                color="secondary"
                startIcon={<InputIcon />}
                onClick={onImport}
                data-test-id="import-project"
              >
                Import project
              </Button>
              <Button
                variant="contained"
                color="secondary"
                startIcon={<LightbulbIcon />}
                onClick={goToExamples}
                data-test-id="explore-examples"
              >
                Explore Examples
              </Button>
            </Stack>
            <DataTable<ProjectRow>
              id="project-list"
              isLoading={isValidating}
              selectable
              hideSearch
              onRowClick={onRowClick}
              deleteSelectedRows={deleteSelectedRows}
              columns={columns}
              rows={projectRows}
              data-test-id="projects-table"
            />
          </>
        )}
      </div>
    </Layout>
  );
};

export default ProjectsView;
