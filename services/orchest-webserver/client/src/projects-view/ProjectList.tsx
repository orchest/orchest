import { useAppContext } from "@/contexts/AppContext";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import ListItemIcon from "@mui/material/ListItemIcon";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { fetcher, HEADER } from "@orchest/lib-utils";
import React from "react";
import { useFetchProjectsForProjectsView } from "./hooks/useFetchProjectsForProjectsView";
import { ProjectsTable } from "./ProjectsTable";

export const ProjectList = () => {
  const { setConfirm, setAlert } = useAppContext();
  const { navigateTo } = useCustomRoute();
  const {
    dispatch,
    state: { projectUuid, projects },
  } = useProjectsContext();

  useFetchProjectsForProjectsView(!projects);

  const [
    selectedProjectMenuButton,
    setSelectedProjectMenuButton,
  ] = React.useState<{ element: HTMLElement; uuid: string }>();

  const [projectBeingDeleted, setProjectBeingDeleted] = React.useState<
    string
  >();

  const closeProjectMenu = () => setSelectedProjectMenuButton(undefined);

  const openProjectMenu = React.useCallback(
    (projectUuid: string) => (event: React.MouseEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setSelectedProjectMenuButton({
        element: event.currentTarget,
        uuid: projectUuid,
      });
    },
    []
  );

  const openSettings = (e: React.MouseEvent) => {
    if (selectedProjectMenuButton)
      navigateTo(
        siteMap.projectSettings.path,
        { query: { projectUuid: selectedProjectMenuButton.uuid } },
        e
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
      dispatch((current) => {
        const updatedProjects = (current.projects || []).filter(
          (project) => project.uuid !== toBeDeletedId
        );
        return { type: "SET_PROJECTS", payload: updatedProjects };
      });
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
      <ProjectsTable
        projects={projects}
        openProjectMenu={openProjectMenu}
        projectBeingDeleted={projectBeingDeleted}
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
  );
};
