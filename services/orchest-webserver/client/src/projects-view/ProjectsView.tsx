import { IconButton } from "@/components/common/IconButton";
import {
  DataTable,
  DataTableColumn,
  DataTableRow,
} from "@/components/DataTable";
import { defaultOverlaySx, DropZone } from "@/components/DropZone";
import { useAppContext } from "@/contexts/AppContext";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useImportUrlFromQueryString } from "@/hooks/useImportUrl";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { siteMap } from "@/routingConfig";
import type { Project } from "@/types";
import { wait } from "@/utils/dev-utils";
import { fetcher } from "@/utils/fetcher";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import MoreHorizOutlinedIcon from "@mui/icons-material/MoreHorizOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import ListItemIcon from "@mui/material/ListItemIcon";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import { HEADER } from "@orchest/lib-utils";
import React from "react";
import { CreateProjectDialog } from "./CreateProjectDialog";
import { ExampleCard } from "./ExampleCard";
import { useFetchExamples } from "./hooks/useFetchExamples";
import { useFetchProjectsForProjectsView } from "./hooks/useFetchProjectsForProjectsView";
import { ImportDialog } from "./ImportDialog";
import { ProjectTabPanel } from "./ProjectTabPanel";
import { TempLayout } from "./TempLayout";

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

const projectTabs = ["My projects", "Example projects"];

enum PROJECT_TAB {
  "MY_PROJECTS" = 0,
  "EXAMPLE_PROJECTS" = 1,
}

const isCuratedByOrchest = (owner: string) =>
  ["orchest", "orchest-examples"].includes(owner.toLowerCase());

const ProjectsView: React.FC = () => {
  const { state, setAlert, setConfirm } = useAppContext();
  useSendAnalyticEvent("view:loaded", { name: siteMap.projects.path });

  const {
    dispatch,
    state: { projectUuid, projects },
  } = useProjectsContext();
  const { navigateTo } = useCustomRoute();

  const [projectBeingDeleted, setProjectBeingDeleted] = React.useState<
    string
  >();

  const [isShowingCreateModal, setIsShowingCreateModal] = React.useState(false);

  const [isImportDialogOpen, setIsImportDialogOpen] = React.useState(false);

  const [
    selectedProjectMenuButton,
    setSelectedProjectMenuButton,
  ] = React.useState<{ element: HTMLElement; uuid: string }>();

  const openProjectMenu = (projectUuid: string) => (
    event: React.MouseEvent<HTMLElement>
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedProjectMenuButton({
      element: event.currentTarget,
      uuid: projectUuid,
    });
  };

  console.log("DEV hey!");

  const closeProjectMenu = () => setSelectedProjectMenuButton(undefined);

  const openSettings = (e: React.MouseEvent) => {
    if (selectedProjectMenuButton)
      navigateTo(
        siteMap.projectSettings.path,
        { query: { projectUuid: selectedProjectMenuButton.uuid } },
        e
      );
  };
  const columns: DataTableColumn<ProjectRow>[] = React.useMemo(() => {
    return [
      {
        id: "path",
        label: "Project",
        sx: { margin: (theme) => theme.spacing(-0.5, 0) },
        render: function ProjectPath(row) {
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
        label: "",
        sx: { margin: (theme) => theme.spacing(-0.5, 0) },
        render: function ProjectSettingsButton(row, disabled) {
          return projectBeingDeleted !== row.uuid ? (
            <IconButton
              title="settings"
              disabled={disabled}
              size="small"
              data-test-id={`settings-button-${row.path}`}
              onClick={openProjectMenu(row.uuid)}
            >
              <MoreHorizOutlinedIcon fontSize="small" />
            </IconButton>
          ) : (
            "Deleting..."
          );
        },
      },
    ];
  }, [projectBeingDeleted]);

  const {
    fetchProjects,
    isFetchingProjects,
  } = useFetchProjectsForProjectsView();

  const projectRows: DataTableRow<ProjectRow>[] = React.useMemo(() => {
    return projects.map((project) => {
      return {
        ...project,
        settings: project.path,
        disabled: projectBeingDeleted === project.uuid,
      };
    });
  }, [projects, projectBeingDeleted]);

  const onRowClick = (e: React.MouseEvent, projectUuid: string) => {
    navigateTo(siteMap.pipeline.path, { query: { projectUuid } }, e);
  };

  const deleteProject = async () => {
    if (!selectedProjectMenuButton) return;
    // setConfirm returns a Promise, which is then passed to DataTable deleteSelectedRows function
    // DataTable then is able to act upon the outcome of the deletion operation
    return setConfirm(
      "Warning",
      "Are you certain that you want to delete this project? This will kill all associated resources and also delete all corresponding jobs. (This cannot be undone.)",
      async (resolve) => {
        // we don't await this Promise on purpose
        // because we want the dialog close first, and resolve setConfirm later
        requestDeleteProject(selectedProjectMenuButton.uuid);
        resolve(true);
        return true; // 1. this is resolved first, thus, the dialog will be gone once user click CONFIRM
      }
    );
  };

  const requestDeleteProject = async (toBeDeletedId: string) => {
    if (projectUuid === toBeDeletedId) {
      dispatch({ type: "SET_PROJECT", payload: undefined });
    }

    setProjectBeingDeleted(toBeDeletedId);
    setSelectedProjectMenuButton(undefined);
    try {
      await fetcher("/async/projects", {
        method: "DELETE",
        headers: HEADER.JSON,
        body: JSON.stringify({ project_uuid: toBeDeletedId }),
      });
      await wait(3000);
      fetchProjects();
    } catch (error) {
      setAlert("Error", `Could not delete project. ${error.message}`);
    }
    setProjectBeingDeleted(undefined);
  };

  const onCreateClick = () => {
    setIsShowingCreateModal(true);
  };

  const onCloseCreateProjectModal = () => {
    setIsShowingCreateModal(false);
  };

  const onImport = () => {
    setIsImportDialogOpen(true);
  };

  const importWithUrl = (url: string) => {
    setImportUrl(url);
    setIsImportDialogOpen(true);
  };

  const [importUrl, setImportUrl] = useImportUrlFromQueryString();
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

  const [projectTabIndex, setProjectTabIndex] = React.useState<PROJECT_TAB>(
    PROJECT_TAB.MY_PROJECTS
  );
  const onClickTab = React.useCallback(
    (tabIndex: number) => setProjectTabIndex(tabIndex),
    []
  );

  const { data: examples = [] } = useFetchExamples();

  return (
    <TempLayout>
      <DropZone
        className="view-page projects-view"
        uploadFiles={dropFilesToCreateProject}
        disabled={
          isImportDialogOpen ||
          isShowingCreateModal ||
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
          importUrl={importUrl}
          setImportUrl={setImportUrl}
          open={isImportDialogOpen}
          onClose={() => setIsImportDialogOpen(false)}
          filesToUpload={filesToUpload}
          confirmButtonLabel={`Save & view`}
        />
        <CreateProjectDialog
          projects={projects}
          open={isShowingCreateModal}
          onClose={onCloseCreateProjectModal}
        />
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ marginBottom: (theme) => theme.spacing(1) }}
        >
          <Typography variant="h4">Projects</Typography>
          <Stack direction="row" spacing={2}>
            <Button
              variant="text"
              startIcon={<DownloadOutlinedIcon />}
              onClick={onImport}
              data-test-id="import-project"
            >
              Import
            </Button>
            <Button
              variant="contained"
              autoFocus
              startIcon={<AddIcon />}
              onClick={onCreateClick}
              data-test-id="add-project"
            >
              New project
            </Button>
          </Stack>
        </Stack>
        <Tabs
          value={projectTabIndex}
          aria-label="Projects tabs"
          sx={{ borderBottom: (theme) => `1px solid ${theme.borderColor}` }}
        >
          {projectTabs.map((projectTab, index) => {
            return (
              <Tab
                key={projectTab}
                label={projectTab}
                aria-label={projectTab}
                sx={{
                  minWidth: (theme) => theme.spacing(24),
                  paddingLeft: (theme) => theme.spacing(1),
                  paddingRight: (theme) => theme.spacing(1),
                }}
                onClick={() => onClickTab(index)}
                onAuxClick={() => onClickTab(index)}
              />
            );
          })}
        </Tabs>
        <ProjectTabPanel
          id="projects"
          value={projectTabIndex}
          index={PROJECT_TAB.MY_PROJECTS}
        >
          {projectRows.length === 0 && isFetchingProjects ? (
            <LinearProgress />
          ) : (
            <>
              <DataTable<ProjectRow>
                id="project-list"
                isLoading={isFetchingProjects}
                hideSearch
                onRowClick={onRowClick}
                columns={columns}
                rows={projectRows}
                data-test-id="projects-table"
              />
              {selectedProjectMenuButton && (
                <Menu
                  anchorEl={selectedProjectMenuButton.element}
                  id="project-menu"
                  open={Boolean(selectedProjectMenuButton)}
                  onClose={closeProjectMenu}
                  transformOrigin={{ horizontal: "right", vertical: "top" }}
                  anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
                >
                  <MenuItem onClick={openSettings}>
                    <ListItemIcon>
                      <SettingsOutlinedIcon fontSize="small" />
                    </ListItemIcon>
                    Project settings
                  </MenuItem>
                  <MenuItem onClick={deleteProject}>
                    <ListItemIcon>
                      <DeleteOutlineOutlinedIcon fontSize="small" />
                    </ListItemIcon>
                    Delete project
                  </MenuItem>
                </Menu>
              )}
            </>
          )}
        </ProjectTabPanel>
        <ProjectTabPanel
          id="example-projects"
          value={projectTabIndex}
          index={PROJECT_TAB.EXAMPLE_PROJECTS}
        >
          <Box sx={{ display: "flex", flexWrap: "wrap" }}>
            {examples.map((item) => {
              return (
                <ExampleCard
                  key={item.url}
                  {...item}
                  startImport={importWithUrl}
                />
              );
            })}
          </Box>
        </ProjectTabPanel>
      </DropZone>
    </TempLayout>
  );
};

export default ProjectsView;
