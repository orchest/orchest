import { useProjectsApi } from "@/api/projects/useProjectsApi";
import { useConfirm } from "@/hooks/useConfirm";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
import { Project } from "@/types";
import red from "@mui/material/colors/red";
import Menu, { MenuProps } from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import React from "react";
import { RenameProjectDialog } from "./RenameProjectDialog";

export type ProjectContextMenuProps = Omit<MenuProps, "open"> & {
  project: Project;
  onDeleted?: () => void;
};

export const ProjectContextMenu = ({
  project,
  onDeleted,
  ...menuProps
}: ProjectContextMenuProps) => {
  const { navigateTo } = useCustomRoute();
  const deleteProject = useProjectsApi((api) => api.delete);
  const deleting = useProjectsApi((api) => api.deleting);
  const deleteWithConfirm = useConfirm(
    () => deleteProject(project.uuid).then(onDeleted),
    {
      title: `Delete ${project.path}?`,
      content:
        "Warning: Deleting a Project is permanent. All associated Jobs and resources will be deleted and unrecoverable.",
      cancelLabel: "Keep project",
      confirmLabel: "Delete project",
      confirmButtonColor: "error",
    }
  );
  const [isRenaming, setIsRenaming] = React.useState(false);

  const openSettings = (event: React.MouseEvent) =>
    navigateTo(
      siteMap.projectSettings.path,
      { query: { projectUuid: project.uuid } },
      event
    );

  const closeAfter = (action: () => void) => {
    action();
    menuProps.onClose?.({}, "escapeKeyDown");
  };

  return (
    <>
      <Menu
        data-test-id="project-context-menu"
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
        open={!isRenaming}
        {...menuProps}
      >
        <MenuItem
          data-test-id="project-context-menu-settings"
          onClick={(event) => closeAfter(() => openSettings(event))}
        >
          Project settings
        </MenuItem>
        <MenuItem
          data-test-id="project-context-menu-rename"
          onClick={() => setIsRenaming(true)}
        >
          Rename
        </MenuItem>
        <MenuItem
          data-test-id="project-context-menu-delete"
          onClick={() => closeAfter(() => deleteWithConfirm())}
          disabled={deleting.includes(project.uuid)}
          sx={{ color: red[500] }}
        >
          Delete
        </MenuItem>
      </Menu>

      <RenameProjectDialog
        project={project}
        open={isRenaming}
        onClose={() => closeAfter(() => setIsRenaming(false))}
      />
    </>
  );
};
