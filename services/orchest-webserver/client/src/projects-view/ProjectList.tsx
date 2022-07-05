import { IconButton } from "@/components/common/IconButton";
import {
  DataTable,
  DataTableColumn,
  DataTableRow,
} from "@/components/DataTable";
import { useAppContext } from "@/contexts/AppContext";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
import { Project } from "@/types";
import { ellipsis } from "@/utils/styles";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import MoreHorizOutlinedIcon from "@mui/icons-material/MoreHorizOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import Box from "@mui/material/Box";
import ListItemIcon from "@mui/material/ListItemIcon";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import { fetcher, hasValue, HEADER } from "@orchest/lib-utils";
import React from "react";
import { NoProject } from "./NoProject";

export type ProjectRow = Pick<
  Project,
  | "path"
  | "pipeline_count"
  | "session_count"
  | "job_count"
  | "environment_count"
> & {
  settings: string;
};

export const ProjectList = ({
  refetch,
}: {
  refetch: () => void | Promise<Project[]>;
}) => {
  const { setConfirm, setAlert } = useAppContext();
  const { navigateTo } = useCustomRoute();
  const {
    dispatch,
    state: { projectUuid, projects, hasLoadedProjects },
  } = useProjectsContext();

  const [
    selectedProjectMenuButton,
    setSelectedProjectMenuButton,
  ] = React.useState<{ element: HTMLElement; uuid: string }>();

  const [projectBeingDeleted, setProjectBeingDeleted] = React.useState<
    string
  >();

  const columns: DataTableColumn<ProjectRow>[] = React.useMemo(() => {
    return [
      {
        id: "path",
        label: "Project",
        sx: { margin: (theme) => theme.spacing(-0.5, 0) },
        render: function ProjectPath(row) {
          return (
            <Tooltip title={row.path}>
              <Box sx={ellipsis((theme) => theme.spacing(60))}>{row.path}</Box>
            </Tooltip>
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

  const projectRows: DataTableRow<ProjectRow>[] = React.useMemo(() => {
    if (!projects) return [];
    return projects.map((project) => {
      return {
        ...project,
        settings: project.path,
        disabled: projectBeingDeleted === project.uuid,
      };
    });
  }, [projects, projectBeingDeleted]);

  const closeProjectMenu = () => setSelectedProjectMenuButton(undefined);

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

  const openSettings = (e: React.MouseEvent) => {
    if (selectedProjectMenuButton)
      navigateTo(
        siteMap.projectSettings.path,
        { query: { projectUuid: selectedProjectMenuButton.uuid } },
        e
      );
  };

  const onRowClick = (e: React.MouseEvent, projectUuid: string) => {
    navigateTo(siteMap.pipeline.path, { query: { projectUuid } }, e);
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
      refetch();
    } catch (error) {
      setAlert("Error", `Could not delete project. ${error.message}`);
    }
    setProjectBeingDeleted(undefined);
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

  return (
    <>
      {projectRows.length === 0 && hasLoadedProjects ? (
        <NoProject />
      ) : (
        <>
          <DataTable<ProjectRow>
            id="project-list"
            isLoading={!hasValue(projects)}
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
    </>
  );
};
