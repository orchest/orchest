import { IconButton } from "@/components/common/IconButton";
import { PageTitle } from "@/components/common/PageTitle";
import {
  DataTable,
  DataTableColumn,
  DataTableRow,
} from "@/components/DataTable";
import { defaultOverlaySx, DropZone } from "@/components/DropZone";
import { Layout } from "@/components/Layout";
import { useAppContext } from "@/contexts/AppContext";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useCheckUpdate } from "@/hooks/useCheckUpdate";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useImportUrl } from "@/hooks/useImportUrl";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { siteMap } from "@/routingConfig";
import type { Project } from "@/types";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import InputIcon from "@mui/icons-material/Input";
import LightbulbIcon from "@mui/icons-material/Lightbulb";
import SettingsIcon from "@mui/icons-material/Settings";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import { hasValue, makeRequest } from "@orchest/lib-utils";
import React from "react";
import { CreateProjectDialog } from "./CreateProjectDialog";
import { EditProjectPathDialog } from "./EditProjectPathDialog";
import { useFetchProjectsForProjectsView } from "./hooks/useFetchProjectsForProjectsView";
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
    state: { projectUuid, projects },
  } = useProjectsContext();
  const { navigateTo } = useCustomRoute();

  const [projectUuidOnEdit, setProjectUuidOnEdit] = React.useState<
    string | undefined
  >();

  const [isShowingCreateModal, setIsShowingCreateModal] = React.useState(false);

  const [isImportDialogOpen, setIsImportDialogOpen] = React.useState(false);

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
    fetchProjects,
    setProjects,
    isFetchingProjects,
  } = useFetchProjectsForProjectsView();

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
    setIsImportDialogOpen(true);
  };

  const onImportComplete = (newProject: Pick<Project, "uuid" | "path">) => {
    navigateTo(siteMap.pipeline.path, {
      query: { projectUuid: newProject.uuid },
    });
  };

  const [importUrl, setImportUrl] = useImportUrl();
  // if user loads the app with a pre-filled import_url in their query string
  // we prompt them directly with the import modal
  React.useEffect(() => {
    if (state.hasCompletedOnboarding && importUrl !== "") {
      setIsImportDialogOpen(true);
    }
  }, [importUrl, state.hasCompletedOnboarding]);

  const [filesToUpload, setFilesToUpload] = React.useState<
    FileList | File[] | undefined
  >();

  const dropFilesToCreateProject = React.useCallback(
    (files: FileList | File[]) => {
      setFilesToUpload(files);
      setIsImportDialogOpen(true);
    },
    []
  );

  return (
    <Layout>
      <DropZone
        className="view-page projects-view"
        uploadFiles={dropFilesToCreateProject}
        disabled={
          isImportDialogOpen ||
          isShowingCreateModal ||
          hasValue(projectUuidOnEdit) ||
          (projectRows.length === 0 && isFetchingProjects)
        }
        sx={{
          display: "flex",
          flexDirection: "column",
          minHeight: "100%",
          width: "100%",
        }}
        overlayProps={{
          sx: {
            ...defaultOverlaySx,
            margin: (theme) => theme.spacing(-4),
            top: (theme) => theme.spacing(12.125),
            width: "100%",
            height: (theme) => `calc(100% - ${theme.spacing(8.125)})`,
            border: (theme) => `2px solid ${theme.palette.primary.main}`,
          },
        }}
      >
        <ImportDialog
          onImportComplete={onImportComplete}
          importUrl={importUrl}
          setImportUrl={setImportUrl}
          open={isImportDialogOpen}
          onClose={() => setIsImportDialogOpen(false)}
          filesToUpload={filesToUpload}
          confirmButtonLabel={`Save & view`}
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
          <>
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
          </>
        )}
      </DropZone>
    </Layout>
  );
};

export default ProjectsView;
