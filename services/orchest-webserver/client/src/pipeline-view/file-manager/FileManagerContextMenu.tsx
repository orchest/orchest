import { useFileApi } from "@/api/files/useFileApi";
import { Code } from "@/components/common/Code";
import { useGlobalContext } from "@/contexts/GlobalContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
import { unpackPath } from "@/utils/file";
import { Point2D } from "@/utils/geometry";
import { hasExtension, isDirectory, join } from "@/utils/path";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { ALLOWED_STEP_EXTENSIONS, hasValue } from "@orchest/lib-utils";
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
  const { setAlert } = useGlobalContext();
  const duplicate = useFileApi((api) => api.duplicate);
  const refresh = useFileApi((api) => api.refresh);
  const { navigateTo, jobUuid, projectUuid, snapshotUuid } = useCustomRoute();
  const {
    pipelineUuid,
    pipelineCwd,
    isReadOnly,
    runUuid,
    pipelineJson,
    isJobRun,
    isSnapshot,
  } = usePipelineDataContext();
  const isRunningOnSnapshot = isJobRun || isSnapshot;
  const { navigateToJupyterLab } = useOpenFile();

  const additionalQueryArgs = React.useMemo(() => {
    if (!jobUuid) return {};
    if (runUuid) return { jobUuid, runUuid };
    if (snapshotUuid) return { jobUuid, snapshotUuid };
    return {};
  }, [jobUuid, runUuid, snapshotUuid]);

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
    navigateToJupyterLab(undefined, cleanFilePath(contextMenuPath));
  }, [contextMenuPath, navigateToJupyterLab, handleClose, isReadOnly]);

  const handleViewFile = React.useCallback(() => {
    handleClose();

    if (!pipelineUuid || !pipelineCwd) return;

    const foundStep = Object.values(pipelineJson?.steps || {}).find((step) => {
      const filePath = join(pipelineCwd, step.file_path);
      return filePath.replace(/^\//, "") === cleanFilePath(contextMenuPath);
    });

    if (!foundStep) {
      setAlert(
        "Warning",
        <div>
          <Code>{cleanFilePath(contextMenuPath)}</Code> is not yet used in this
          pipeline. To preview the file, you need to assign this file to a step
          first.
        </div>
      );
      return;
    }

    navigateTo(
      isRunningOnSnapshot
        ? siteMap.jobRunFilePreview.path
        : siteMap.filePreview.path,
      {
        query: {
          projectUuid,
          pipelineUuid,
          stepUuid: foundStep.uuid,
          ...additionalQueryArgs,
        },
        state: { isReadOnly },
      }
    );
  }, [
    contextMenuPath,
    handleClose,
    isReadOnly,
    isRunningOnSnapshot,
    additionalQueryArgs,
    navigateTo,
    pipelineCwd,
    pipelineJson?.steps,
    pipelineUuid,
    projectUuid,
    setAlert,
  ]);

  const hasPath = Boolean(path);
  const isInProjectDir = root === "/project-dir";
  const isFile = !isDirectory(path);
  const canView = isFile && hasExtension(path, ...ALLOWED_STEP_EXTENSIONS);
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
          Edit
        </MenuItem>
      )}
      {hasPath && pipelineUuid && canView && (
        <MenuItem dense onClick={handleViewFile}>
          View
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
