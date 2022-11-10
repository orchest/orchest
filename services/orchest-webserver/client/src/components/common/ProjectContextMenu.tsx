import { useProjectsApi } from "@/api/projects/useProjectsApi";
import { useConfirm } from "@/hooks/useConfirm";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
import { Project } from "@/types";
import Menu, { MenuProps } from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import React from "react";
import { RenameProjectDialog } from "./RenameProjectDialog";

export type ProjectContextMenuProps = Omit<MenuProps, "open"> & {
  project: Project;
};

export const ProjectContextMenu = ({
  project,
  ...menuProps
}: ProjectContextMenuProps) => {
  const { navigateTo } = useCustomRoute();
  const deleteProject = useProjectsApi((api) => api.delete);
  const deleting = useProjectsApi((api) => api.deleting);
  const deleteWithConfirm = useConfirm(deleteProject, {
    title: `Delete "${project.path}"?`,
    content:
      "Warning: Deleting a Project is permanent. All associated Jobs and resources will be deleted and unrecoverable.",
    cancelLabel: "Keep project",
    confirmLabel: "Delete project",
  });
  const [isRenaming, setIsRenaming] = React.useState(false);

  const openSettings = (event: React.MouseEvent) =>
    navigateTo(
      siteMap.projectSettings.path,
      { query: { projectUuid: project.uuid } },
      event
    );

  return (
    <>
      <Menu
        data-test-id="project-context-menu"
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
        open={true}
        {...menuProps}
      >
        <MenuItem
          data-test-id="project-context-menu-settings"
          onClick={openSettings}
        >
          Project settings
        </MenuItem>
        <MenuItem
          data-test-id="project-context-menu-rename"
          onClick={() => setIsRenaming(true)}
        >
          Rename project
        </MenuItem>
        <MenuItem
          data-test-id="project-context-menu-delete"
          onClick={() => deleteWithConfirm(project.uuid)}
          disabled={deleting.includes(project.uuid)}
        >
          Delete Project
        </MenuItem>
      </Menu>

      <RenameProjectDialog
        project={project}
        open={isRenaming}
        onClose={() => setIsRenaming(true)}
      />
    </>
  );
};
