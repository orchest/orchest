import { Code } from "@/components/common/Code";
import { useAppContext } from "@/contexts/AppContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
import { Point2D } from "@/utils/geometry";
import { join } from "@/utils/path";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { ALLOWED_STEP_EXTENSIONS, hasValue } from "@orchest/lib-utils";
import React from "react";
import { usePipelineDataContext } from "../contexts/PipelineDataContext";
import { useOpenFile } from "../hooks/useOpenFile";
import {
  cleanFilePath,
  FILE_MANAGEMENT_ENDPOINT,
  queryArgs,
  unpackPath,
} from "./common";
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
  const { setAlert } = useAppContext();
  const { navigateTo, jobUuid, projectUuid } = useCustomRoute();
  const {
    pipelineUuid,
    pipelineCwd,
    isReadOnly,
    runUuid,
    pipelineJson,
  } = usePipelineDataContext();

  const { navigateToJupyterLab } = useOpenFile();

  const { isJobRun, jobRunQueryArgs } = React.useMemo(() => {
    return {
      isJobRun: hasValue(jobUuid) && hasValue(runUuid),
      jobRunQueryArgs: { jobUuid, runUuid },
    };
  }, [jobUuid, runUuid]);

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
      return filePath === cleanFilePath(contextMenuCombinedPath);
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

    navigateTo(siteMap.filePreview.path, {
      query: {
        projectUuid,
        pipelineUuid,
        stepUuid: foundStep.uuid,
        ...(isJobRun ? jobRunQueryArgs : undefined),
      },
      state: { isReadOnly },
    });
  }, [
    contextMenuCombinedPath,
    handleClose,
    isJobRun,
    isReadOnly,
    jobRunQueryArgs,
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

  return (
    <Menu
      open={metadata !== undefined}
      onClose={handleClose}
      anchorReference="anchorPosition"
      anchorPosition={
        metadata !== undefined
          ? {
              top: metadata?.origin[0] ?? 0,
              left: metadata?.origin[0] ?? 0,
            }
          : undefined
      }
    >
      {metadata?.type === "tree" && (
        <>
          {!isReadOnly && contextPathIsFile && rootIsProject && (
            <MenuItem dense disabled={isReadOnly} onClick={handleContextEdit}>
              Edit
            </MenuItem>
          )}
          {pipelineUuid && contextPathIsAllowedFileType && (
            <MenuItem dense onClick={handleContextView}>
              View
            </MenuItem>
          )}
          {!isReadOnly && (
            <>
              <MenuItem
                dense
                disabled={isReadOnly}
                onClick={handleContextRename}
              >
                Rename
              </MenuItem>
              <MenuItem dense disabled={isReadOnly} onClick={handleDuplicate}>
                Duplicate
              </MenuItem>
              <MenuItem dense disabled={isReadOnly} onClick={handleDelete}>
                Delete
              </MenuItem>
            </>
          )}
          <MenuItem dense onClick={handleDownload}>
            Download
          </MenuItem>
        </>
      )}
      {children}
    </Menu>
  );
};
