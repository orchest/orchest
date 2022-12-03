import { useFileApi } from "@/api/files/useFileApi";
import { unpackPath } from "@/utils/file";
import { isDirectory } from "@/utils/path";
import Menu, { MenuProps } from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import React from "react";
import { useFileManagerLocalContext } from "../contexts/FileManagerLocalContext";
import { usePipelineDataContext } from "../contexts/PipelineDataContext";
import { cleanFilePath } from "../file-manager/common";
import { useOpenFile } from "../hooks/useOpenFile";

type FileContextMenuProps = {
  onCollapse?: () => void;
} & MenuProps;

export const FileContextMenu = ({
  onCollapse,
  ...menuProps
}: FileContextMenuProps) => {
  const duplicate = useFileApi((api) => api.duplicate);
  const refresh = useFileApi((api) => api.refresh);
  const { isReadOnly } = usePipelineDataContext();
  const { openInJupyterLab } = useOpenFile();

  const {
    handleClose,
    handleRename,
    handleDelete,
    handleDownload,
    contextMenuPath = "",
  } = useFileManagerLocalContext();

  const { root, path } = unpackPath(contextMenuPath);

  const handleDuplicate = React.useCallback(() => {
    if (isReadOnly) return;
    duplicate(root, path);
    handleClose();
  }, [isReadOnly, root, path, duplicate, handleClose]);

  const handleEditFile = React.useCallback(() => {
    if (isReadOnly) return;
    handleClose();
    openInJupyterLab(cleanFilePath(contextMenuPath));
  }, [contextMenuPath, openInJupyterLab, handleClose, isReadOnly]);

  const hasPath = Boolean(path);
  const isInProjectDir = root === "/project-dir";
  const isFile = !isDirectory(path);
  const isRoot = path === "/";

  console.log({ menuProps });

  return (
    <Menu {...menuProps}>
      {!(hasPath || isRoot) && onCollapse && (
        <MenuItem
          dense
          onClick={() => {
            onCollapse();
            handleClose();
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
            handleClose();
          }}
        >
          Refresh
        </MenuItem>
      )}
      {hasPath && isFile && isInProjectDir && (
        <MenuItem dense disabled={isReadOnly} onClick={handleEditFile}>
          Edit in JupyterLab
        </MenuItem>
      )}
      {hasPath && !isRoot && (
        <MenuItem dense disabled={isReadOnly} onClick={handleRename}>
          Rename
        </MenuItem>
      )}
      {hasPath && !isRoot && (
        <MenuItem dense disabled={isReadOnly} onClick={handleDuplicate}>
          Duplicate
        </MenuItem>
      )}
      {hasPath && !isRoot && (
        <MenuItem dense disabled={isReadOnly} onClick={handleDelete}>
          Delete
        </MenuItem>
      )}
      {hasPath && (
        <MenuItem dense disabled={isReadOnly} onClick={handleDownload}>
          Download
        </MenuItem>
      )}
    </Menu>
  );
};
