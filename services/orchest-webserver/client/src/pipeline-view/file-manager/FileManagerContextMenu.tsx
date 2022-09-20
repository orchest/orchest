import { Code } from "@/components/common/Code";
import { useGlobalContext } from "@/contexts/GlobalContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
import { Point2D } from "@/utils/geometry";
import { join } from "@/utils/path";
import { queryArgs } from "@/utils/text";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { ALLOWED_STEP_EXTENSIONS, hasValue } from "@orchest/lib-utils";
import React from "react";
import { usePipelineDataContext } from "../contexts/PipelineDataContext";
import { useOpenFile } from "../hooks/useOpenFile";
import { cleanFilePath, FILE_MANAGEMENT_ENDPOINT, unpackPath } from "./common";
import { useFileManagerLocalContext } from "./FileManagerLocalContext";

export type ContextMenuType = "tree" | "background";

export type ContextMenuMetadata =
  | {
      origin: Point2D;
      type: ContextMenuType;
    }
  | undefined;

export const FileManagerContextMenu: React.FC<{
  metadata: ContextMenuMetadata | undefined;
}> = ({ metadata, children }) => {
  const { setAlert } = useGlobalContext();
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
    reload,
    handleClose,
    handleContextRename,
    handleDelete,
    handleDownload,
    contextMenuCombinedPath = "",
  } = useFileManagerLocalContext();

  const handleDuplicate = React.useCallback(async () => {
    if (isReadOnly || !projectUuid) return;

    handleClose();

    const { root, path } = unpackPath(contextMenuCombinedPath);

    await fetch(
      `${FILE_MANAGEMENT_ENDPOINT}/duplicate?${queryArgs({
        path,
        root,
        projectUuid,
      })}`,
      { method: "POST" }
    );
    reload();
  }, [projectUuid, contextMenuCombinedPath, handleClose, reload, isReadOnly]);

  const handleContextEdit = React.useCallback(() => {
    if (isReadOnly) return;
    handleClose();
    navigateToJupyterLab(undefined, cleanFilePath(contextMenuCombinedPath));
  }, [contextMenuCombinedPath, navigateToJupyterLab, handleClose, isReadOnly]);

  const handleContextView = React.useCallback(() => {
    handleClose();

    if (!pipelineUuid || !pipelineCwd) return;

    const foundStep = Object.values(pipelineJson?.steps || {}).find((step) => {
      const filePath = join(pipelineCwd, step.file_path);
      return (
        filePath.replace(/^\//, "") === cleanFilePath(contextMenuCombinedPath)
      );
    });

    if (!foundStep) {
      setAlert(
        "Warning",
        <div>
          <Code>{cleanFilePath(contextMenuCombinedPath)}</Code> is not yet used
          in this pipeline. To preview the file, you need to assign this file to
          a step first.
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
    contextMenuCombinedPath,
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

  const rootIsProject =
    hasValue(contextMenuCombinedPath) &&
    contextMenuCombinedPath.startsWith("/project-dir");

  const contextPathIsFile =
    contextMenuCombinedPath && !contextMenuCombinedPath.endsWith("/");

  const contextPathIsAllowedFileType =
    contextMenuCombinedPath &&
    ALLOWED_STEP_EXTENSIONS.some((allowedType) =>
      contextMenuCombinedPath
        .toLocaleLowerCase()
        .endsWith(`.${allowedType.toLocaleLowerCase()}`)
    );

  const menuItems =
    metadata?.type === "tree"
      ? [
          !isReadOnly && contextPathIsFile && rootIsProject && (
            <MenuItem
              key="edit"
              dense
              disabled={isReadOnly}
              onClick={handleContextEdit}
            >
              Edit
            </MenuItem>
          ),
          pipelineUuid && contextPathIsAllowedFileType && (
            <MenuItem key="view" dense onClick={handleContextView}>
              View
            </MenuItem>
          ),
          !isReadOnly && (
            <MenuItem
              key="rename"
              dense
              disabled={isReadOnly}
              onClick={handleContextRename}
            >
              Rename
            </MenuItem>
          ),
          !isReadOnly && (
            <MenuItem
              key="duplicate"
              dense
              disabled={isReadOnly}
              onClick={handleDuplicate}
            >
              Duplicate
            </MenuItem>
          ),
          !isReadOnly && (
            <MenuItem
              key="delete"
              dense
              disabled={isReadOnly}
              onClick={handleDelete}
            >
              Delete
            </MenuItem>
          ),
          <MenuItem key="download" dense onClick={handleDownload}>
            Download
          </MenuItem>,
          children,
        ].filter(Boolean)
      : null;

  return (
    <Menu
      open={hasValue(metadata)}
      onClose={handleClose}
      anchorReference="anchorPosition"
      anchorPosition={
        hasValue(metadata)
          ? {
              top: metadata?.origin[1] ?? 0,
              left: metadata?.origin[0] ?? 0,
            }
          : undefined
      }
    >
      {menuItems}
      {children}
    </Menu>
  );
};
