import { Code } from "@/components/common/Code";
import { useAppContext } from "@/contexts/AppContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/Routes";
import { Position } from "@/types";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { ALLOWED_STEP_EXTENSIONS, hasValue } from "@orchest/lib-utils";
import React from "react";
import { usePipelineEditorContext } from "../contexts/PipelineEditorContext";
import { useOpenNoteBook } from "../hooks/useOpenNoteBook";
import {
  cleanFilePath,
  FILE_MANAGEMENT_ENDPOINT,
  queryArgs,
  unpackCombinedPath,
} from "./common";
import { useFileManagerLocalContext } from "./FileManagerLocalContext";

export type ContextMenuType = "tree" | "background";

export type ContextMenuMetadata = {
  position: Position;
  type: ContextMenuType;
} | null;

export const FileManagerContextMenu: React.FC<{
  metadata: ContextMenuMetadata;
}> = ({ metadata, children }) => {
  const { setAlert } = useAppContext();
  const { navigateTo, jobUuid } = useCustomRoute();
  const {
    projectUuid,
    pipelineUuid,
    isReadOnly,
    pipelineJson,
    runUuid,
  } = usePipelineEditorContext();

  const openNotebook = useOpenNoteBook();

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
    contextMenuCombinedPath,
  } = useFileManagerLocalContext();

  const handleDuplicate = React.useCallback(async () => {
    if (isReadOnly) return;

    handleClose();

    let { root, path } = unpackCombinedPath(contextMenuCombinedPath);

    await fetch(
      `${FILE_MANAGEMENT_ENDPOINT}/duplicate?${queryArgs({
        path,
        root,
        project_uuid: projectUuid,
      })}`,
      { method: "POST" }
    );
    reload();
  }, [projectUuid, contextMenuCombinedPath, handleClose, reload, isReadOnly]);

  const handleContextEdit = React.useCallback(() => {
    if (isReadOnly) return;
    handleClose();
    openNotebook(undefined, cleanFilePath(contextMenuCombinedPath));
  }, [contextMenuCombinedPath, openNotebook, handleClose, isReadOnly]);

  const handleContextView = React.useCallback(() => {
    handleClose();

    if (!pipelineUuid) return;

    const foundStep = Object.values(pipelineJson.steps).find((step) => {
      return (
        step.file_path.replace(/^\.\//, "") ===
        cleanFilePath(contextMenuCombinedPath)
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
      open={metadata !== null}
      onClose={handleClose}
      anchorReference="anchorPosition"
      anchorPosition={
        metadata !== null
          ? {
              top: metadata?.position.y,
              left: metadata?.position.x,
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
