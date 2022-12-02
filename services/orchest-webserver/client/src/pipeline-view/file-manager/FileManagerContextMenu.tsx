import { useFileApi } from "@/api/files/useFileApi";
import { unpackPath } from "@/utils/file";
import { Point2D } from "@/utils/geometry";
import { isDirectory } from "@/utils/path";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { usePipelineDataContext } from "../contexts/PipelineDataContext";
import { useOpenFile } from "../hooks/useOpenFile";
import { cleanFilePath } from "./common";
import { useFileManagerLocalContext } from "./FileManagerLocalContext";

type FileManagerContextMenuProps = { origin?: Point2D; onCollapse: () => void };

export const FileManagerContextMenu = ({
  origin,
  onCollapse,
}: FileManagerContextMenuProps) => {
  const [left, top] = origin ?? [0, 0];
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

  return (
    <Menu
      open={hasValue(origin)}
      onClose={handleClose}
      anchorReference="anchorPosition"
      anchorPosition={{ left, top }}
    >
      {(!hasPath || isRoot) && (
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
