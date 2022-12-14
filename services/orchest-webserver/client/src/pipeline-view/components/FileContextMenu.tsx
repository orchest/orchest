import { useFileApi } from "@/api/files/useFileApi";
import { FileRoot } from "@/utils/file";
import { isDirectory, join } from "@/utils/path";
import Menu, { MenuProps } from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import React from "react";
import { usePipelineDataContext } from "../contexts/PipelineDataContext";
import { useOpenFile } from "../hooks/useOpenFile";

type FileContextMenuProps = MenuProps & {
  /** The root */
  root: FileRoot;
  /** The path of the selected item. Used to determine which menu items to show. */
  path: string;
  /** Show the "Edit in Jupyter Lab" option. True by default. */
  showEdit?: boolean;
  /** When provided: shows the "Collapse" menu item if the `combinedPath` is a root directory. */
  onClickCollapse?: () => void;
  /** When provided: shows the "Rename" menu item, unless `combinedPath` is a root directory. */
  onClickRename?: () => void;
  /** When provided: shows the "Download" menu item. */
  onClickDownload?: () => void;
  /** When provided: shows the "Delete" menu item, unless `combinedPath` is a root directory. */
  onClickDelete?: () => void;
};

export const FileContextMenu = ({
  root,
  path,
  onClickCollapse,
  onClickRename,
  onClickDownload,
  onClickDelete,
  onClose,
  showEdit = true,
  ...menuProps
}: FileContextMenuProps) => {
  const duplicate = useFileApi((api) => api.duplicate);
  const refresh = useFileApi((api) => api.refresh);
  const { isReadOnly } = usePipelineDataContext();
  const { openInJupyterLab } = useOpenFile();

  const closeMenu = React.useCallback(() => {
    onClose?.({}, "escapeKeyDown");
  }, [onClose]);

  const handleDuplicate = React.useCallback(() => {
    if (isReadOnly) return;
    duplicate(root, path);
    closeMenu();
  }, [isReadOnly, duplicate, root, path, closeMenu]);

  const handleEditFile = React.useCallback(() => {
    if (isReadOnly) return;
    closeMenu();
    openInJupyterLab(root === "/data" ? join(root, path) : path);
  }, [isReadOnly, closeMenu, openInJupyterLab, root, path]);

  const hasPath = Boolean(path);
  const isInProjectDir = root === "/project-dir";
  const isFile = !isDirectory(path);
  const isRoot = path === "/";

  return (
    <Menu onClose={onClose} {...menuProps}>
      {onClickCollapse && (!hasPath || isRoot) && (
        <MenuItem
          dense
          onClick={() => {
            onClickCollapse();
            closeMenu();
          }}
        >
          Collapse all
        </MenuItem>
      )}
      {(!hasPath || isRoot) && (
        <MenuItem
          dense
          onClick={() => {
            refresh();
            closeMenu();
          }}
        >
          Refresh
        </MenuItem>
      )}
      {hasPath && isFile && isInProjectDir && showEdit && (
        <MenuItem dense disabled={isReadOnly} onClick={handleEditFile}>
          Edit in JupyterLab
        </MenuItem>
      )}
      {onClickRename && hasPath && !isRoot && (
        <MenuItem dense disabled={isReadOnly} onClick={onClickRename}>
          Rename
        </MenuItem>
      )}
      {hasPath && !isRoot && (
        <MenuItem dense disabled={isReadOnly} onClick={handleDuplicate}>
          Duplicate
        </MenuItem>
      )}
      {onClickDownload && hasPath && (
        <MenuItem dense disabled={isReadOnly} onClick={onClickDownload}>
          Download
        </MenuItem>
      )}
      {onClickDelete && hasPath && !isRoot && (
        <MenuItem
          dense
          disabled={isReadOnly}
          onClick={onClickDelete}
          sx={{ color: (theme) => theme.palette.error.main }}
        >
          Delete
        </MenuItem>
      )}
    </Menu>
  );
};
