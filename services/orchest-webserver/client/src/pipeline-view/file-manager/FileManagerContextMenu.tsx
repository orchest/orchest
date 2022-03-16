import { Position } from "@/types";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import React from "react";
import { useFileManagerLocalContext } from "./FileManagerLocalContext";

export type ContextMenuType = "tree" | "background";

export type ContextMenuMetadata = {
  position: Position;
  type: ContextMenuType;
} | null;

export const FileManagerContextMenu: React.FC<{
  metadata: ContextMenuMetadata;
}> = ({ metadata, children }) => {
  const {
    handleClose,
    handleContextEdit,
    handleContextView,
    handleContextRename,
    handleDuplicate,
    handleDelete,
    handleDownload,
    contextMenuCombinedPath,
  } = useFileManagerLocalContext();

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
          {contextPathIsFile && (
            <MenuItem dense onClick={handleContextEdit}>
              Edit
            </MenuItem>
          )}
          {contextPathIsFile && (
            <MenuItem dense onClick={handleContextView}>
              View
            </MenuItem>
          )}
          <MenuItem dense onClick={handleContextRename}>
            Rename
          </MenuItem>
          <MenuItem dense onClick={handleDuplicate}>
            Duplicate
          </MenuItem>
          <MenuItem dense onClick={handleDelete}>
            Delete
          </MenuItem>
          <MenuItem dense onClick={handleDownload}>
            Download
          </MenuItem>
        </>
      )}
      {children}
    </Menu>
  );
};
