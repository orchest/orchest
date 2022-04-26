import { IconButton } from "@/components/common/IconButton";
import { PageTitle } from "@/components/common/PageTitle";
import {
  DataTable,
  DataTableColumn,
  DataTableRow,
} from "@/components/DataTable";
import { DropZone, generateUploadFiles } from "@/components/DropZone";
import { Layout } from "@/components/Layout";
import { useAppContext } from "@/contexts/AppContext";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useCheckUpdate } from "@/hooks/useCheckUpdate";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useImportUrl } from "@/hooks/useImportUrl";
import { useMounted } from "@/hooks/useMounted";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { siteMap } from "@/Routes";
import type { Project } from "@/types";
import { BackgroundTask } from "@/utils/webserver-utils";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import InputIcon from "@mui/icons-material/Input";
import LightbulbIcon from "@mui/icons-material/Lightbulb";
import SettingsIcon from "@mui/icons-material/Settings";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import { makeRequest } from "@orchest/lib-utils";
import React from "react";
import { CreateProjectDialog } from "./CreateProjectDialog";
import { EditProjectPathDialog } from "./EditProjectPathDialog";
import { useFetchProjects } from "./hooks/useFetchProjects";
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
  const { state, setAlert, setConfirm } = useAppContext();
  useSendAnalyticEvent("view load", { name: siteMap.projects.path });

  const {
    dispatch,
    state: { projectUuid },
  } = useProjectsContext();
  const { navigateTo } = useCustomRoute();

  const [projectName, setProjectName] = React.useState<string>("");
  const [projectUuidOnEdit, setProjectUuidOnEdit] = React.useState<
    string | undefined
  >();

  const [isShowingCreateModal, setIsShowingCreateModal] = React.useState(false);

  const [isImporting, setIsImporting] = React.useState(false);

  useCheckUpdate();

  const columns: DataTableColumn<ProjectRow>[] = React.useMemo(() => {
    const openSettings = (projectUuid: string) => (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      navigateTo(
        siteMap.projectSettings.path,
        {
          query: { projectUuid },
        },
        e
      );
    };
    const onEditProjectName = (projectUUID: string) => {
      setProjectUuidOnEdit(projectUUID);
    };
    return [
      {
        id: "path",
        label: "Project",
        sx: { margin: (theme) => theme.spacing(-0.5, 0) },
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
                  e.preventDefault();
                  onEditProjectName(row.uuid);
                }}
                onAuxClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
              >
                <EditIcon fontSize="small" />
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
        sx: { margin: (theme) => theme.spacing(-0.5, 0) },
        render: function ProjectSettingsButton(row, disabled) {
          return (
            <IconButton
              title="settings"
              disabled={disabled}
              size="small"
              data-test-id={`settings-button-${row.path}`}
              onClick={openSettings(row.uuid)}
              onAuxClick={openSettings(row.uuid)}
            >
              <SettingsIcon fontSize="small" />
            </IconButton>
          );
        },
      },
    ];
  }, [navigateTo]);

  const onCloseEditProjectPathModal = () => {
    setProjectUuidOnEdit(undefined);
  };

  const {
    projects,
    fetchProjects,
    setProjects,
    fetchProjectsError,
    isFetchingProjects,
  } = useFetchProjects({ sessionCounts: true, jobCounts: true });

  const mounted = useMounted();

  React.useEffect(() => {
    if (mounted.current && fetchProjectsError)
      setAlert("Error", "Error fetching projects");
  }, [fetchProjectsError, setAlert, mounted]);

  React.useEffect(() => {
    if (
      mounted.current &&
      !isFetchingProjects &&
      !fetchProjectsError &&
      projects
    ) {
      dispatch({
        type: "SET_PROJECTS",
        payload: projects,
      });
    }
  }, [projects, mounted, isFetchingProjects, fetchProjectsError, dispatch]);

  const projectRows: DataTableRow<ProjectRow>[] = React.useMemo(() => {
    return projects.map((project) => {
      return {
        ...project,
        settings: project.path,
      };
    });
  }, [projects]);

  const onRowClick = (e: React.MouseEvent, projectUuid: string) => {
    navigateTo(siteMap.pipeline.path, { query: { projectUuid } }, e);
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
            resolve(true); // 2. this is resolved later, and this resolves the Promise returned by setConfirm, and thereafter resolved in DataTable
          })
          .catch(() => {
            resolve(false);
          })
          .finally(() => {
            fetchProjects();
          });
        return true; // 1. this is resolved first, thus, the dialog will be gone once user click CONFIRM
      }
    );
  };

  const deleteProjectRequest = (toBeDeletedId: string) => {
    if (projectUuid === toBeDeletedId) {
      dispatch({ type: "SET_PROJECT", payload: undefined });
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

  const goToExamples = (e: React.MouseEvent) => {
    navigateTo(siteMap.examples.path, undefined, e);
  };

  const onCloseCreateProjectModal = () => {
    setIsShowingCreateModal(false);
  };

  const onImport = () => {
    setIsImporting(true);
  };

  const onImportComplete = (result: BackgroundTask) => {
    if (result.status === "SUCCESS") {
      navigateTo(siteMap.pipeline.path, {
        query: { projectUuid: result.result },
      });
    }
  };

  const [importUrl, setImportUrl] = useImportUrl();
  // if user loads the app with a pre-filled import_url in their query string
  // we prompt them directly with the import modal
  React.useEffect(() => {
    if (state.hasCompletedOnboarding && importUrl !== "") {
      setIsImporting(true);
    }
  }, [importUrl, state.hasCompletedOnboarding]);

  const createProjectAndUploadFiles = React.useCallback(
    async (files: File[] | FileList) => {
      // 0. open create project dialog
      // 1. create a dummy project, get the new `projectUuid`
      const newProjectUuid = "newProjectUuid";
      // 2. upload files
      await Promise.all(
        generateUploadFiles({
          projectUuid: newProjectUuid,
          root: "/project-dir",
          path: "/",
        })(files, () => {
          // update the progress of the create project dialog
        })
      );
      // 3. update project name

      // 4. close create project dialog, redirect to `/pipeline` of this project
    },
    []
  );

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
        <EditProjectPathDialog
          projects={projects}
          projectUuid={projectUuidOnEdit}
          onClose={onCloseEditProjectPathModal}
          setProjects={setProjects}
        />
        <CreateProjectDialog
          projects={projects}
          isOpen={isShowingCreateModal}
          onClose={onCloseCreateProjectModal}
        />
        <PageTitle>Projects</PageTitle>
        {projectRows.length === 0 && isFetchingProjects ? (
          <LinearProgress />
        ) : (
          <DropZone uploadFiles={createProjectAndUploadFiles}>
            <Stack
              direction="row"
              spacing={2}
              sx={{ margin: (theme) => theme.spacing(2, 0) }}
            >
              <Button
                variant="contained"
                autoFocus
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
                onAuxClick={goToExamples}
                data-test-id="explore-examples"
              >
                Explore Examples
              </Button>
            </Stack>
            <DataTable<ProjectRow>
              id="project-list"
              isLoading={isFetchingProjects}
              selectable
              hideSearch
              onRowClick={onRowClick}
              deleteSelectedRows={deleteSelectedRows}
              columns={columns}
              rows={projectRows}
              data-test-id="projects-table"
            />
          </DropZone>
        )}
      </div>
    </Layout>
  );
};

export default ProjectsView;
