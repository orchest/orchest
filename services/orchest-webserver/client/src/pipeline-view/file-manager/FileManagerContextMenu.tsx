import { Code } from "@/components/common/Code";
import { useAppContext } from "@/contexts/AppContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/Routes";
import { Position } from "@/types";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { usePipelineEditorContext } from "../contexts/PipelineEditorContext";
import { useOpenNoteBook } from "../hooks/useOpenNoteBook";
import {
  cleanFilePath,
  PROJECT_DIR_PATH,
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
    baseUrl,
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

    await fetch(`${baseUrl}/duplicate?${queryArgs({ path, root })}`, {
      method: "POST",
    });
    reload();
  }, [baseUrl, contextMenuCombinedPath, handleClose, reload, isReadOnly]);

  const handleContextEdit = React.useCallback(() => {
    if (isReadOnly) return;
    handleClose();
    openNotebook(undefined, cleanFilePath(contextMenuCombinedPath));
  }, [contextMenuCombinedPath, openNotebook, handleClose, isReadOnly]);

  const handleContextView = React.useCallback(() => {
    handleClose();

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

  const rootIsProject = contextMenuCombinedPath
    ? contextMenuCombinedPath.startsWith(PROJECT_DIR_PATH)
    : false;
  const contextPathIsFile =
    contextMenuCombinedPath && !contextMenuCombinedPath.endsWith("/");

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
          {contextPathIsFile && (
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
