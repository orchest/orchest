import { useAppContext } from "@/contexts/AppContext";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { Position } from "@/types";
import React from "react";
import {
  baseNameFromPath,
  FILE_MANAGER_ENDPOINT,
  queryArgs,
  unpackCombinedPath,
} from "./common";
import { useFileManagerContext } from "./FileManagerContext";
import { ContextMenuType } from "./FileManagerContextMenu";

export type FileManagerLocalContextType = {
  baseUrl: string;
  reload: () => Promise<void>;
  handleClose: () => void;
  handleContextMenu: (
    event: React.MouseEvent,
    combinedPath: string,
    type?: ContextMenuType
  ) => void;
  handleSelect: (
    event: React.SyntheticEvent<Element, Event>,
    selected: string[]
  ) => void;
  handleDelete: () => void;
  handleDownload: () => void;
  handleContextRename: () => void;
  contextMenuCombinedPath: string;
  fileInRename: string;
  setFileInRename: React.Dispatch<React.SetStateAction<string>>;
  fileRenameNewName: string;
  setFileRenameNewName: React.Dispatch<React.SetStateAction<string>>;
  setContextMenu: React.Dispatch<
    React.SetStateAction<{
      position: Position;
      type: ContextMenuType;
    }>
  >;
};

export const FileManagerLocalContext = React.createContext<
  FileManagerLocalContextType
>(null);

export const useFileManagerLocalContext = () =>
  React.useContext(FileManagerLocalContext);

const deleteFetch = (projectUuid: string, combinedPath: string) => {
  let { root, path } = unpackCombinedPath(combinedPath);
  return fetch(
    `${FILE_MANAGER_ENDPOINT}/delete?${queryArgs({
      project_uuid: projectUuid,
      path,
      root,
    })}`,
    { method: "POST" }
  );
};

const getBaseNameFromContextMenu = (contextMenuCombinedPath: string) => {
  let pathComponents = contextMenuCombinedPath.split("/");
  if (contextMenuCombinedPath.endsWith("/")) {
    pathComponents = pathComponents.slice(0, -1);
  }
  return pathComponents.slice(-1)[0];
};

const downloadFile = (
  url: string,
  combinedPath: string,
  downloadLink: string
) => {
  let { root, path } = unpackCombinedPath(combinedPath);

  let downloadUrl = `${url}/download?${queryArgs({
    path,
    root,
  })}`;
  const a = document.createElement("a");
  a.href = downloadUrl;
  a.download = downloadLink;
  document.body.appendChild(a);
  a.click();
  a.remove();
};

export const FileManagerLocalContextProvider: React.FC<{
  baseUrl: string;
  reload: () => Promise<void>;
  setContextMenu: React.Dispatch<
    React.SetStateAction<{
      position: Position;
      type: ContextMenuType;
    }>
  >;
}> = ({ children, baseUrl, reload, setContextMenu }) => {
  const { setConfirm } = useAppContext();
  const { projectUuid } = useCustomRoute();

  const { selectedFiles, setSelectedFiles } = useFileManagerContext();

  const [contextMenuCombinedPath, setContextMenuPath] = React.useState<
    string
  >();
  const [fileInRename, setFileInRename] = React.useState<string>(undefined);
  const [fileRenameNewName, setFileRenameNewName] = React.useState("");

  const handleContextMenu = React.useCallback(
    (
      event: React.MouseEvent,
      combinedPath: string,
      type: ContextMenuType = "tree"
    ) => {
      event.preventDefault();
      event.stopPropagation();
      setContextMenuPath(combinedPath);
      setContextMenu((current) => {
        return current === null
          ? {
              position: {
                x: event.clientX - 2,
                y: event.clientY - 4,
              },
              type,
            }
          : null;
      });
    },
    [setContextMenu]
  );

  const handleSelect = React.useCallback(
    (event: React.SyntheticEvent<Element, Event>, selected: string[]) => {
      event.stopPropagation();
      setSelectedFiles(selected);
    },
    [setSelectedFiles]
  );

  const handleClose = React.useCallback(() => {
    setContextMenu(null);
  }, [setContextMenu]);

  const {
    state: { pipelineIsReadOnly },
  } = useProjectsContext();

  const handleContextRename = React.useCallback(() => {
    if (pipelineIsReadOnly) return;

    handleClose();
    setFileInRename(contextMenuCombinedPath);
    setFileRenameNewName(baseNameFromPath(contextMenuCombinedPath));
  }, [contextMenuCombinedPath, handleClose, pipelineIsReadOnly]);

  const handleDelete = React.useCallback(() => {
    if (pipelineIsReadOnly) return;

    handleClose();

    if (
      selectedFiles.includes(contextMenuCombinedPath) &&
      selectedFiles.length > 1
    ) {
      setConfirm(
        "Warning",
        `Are you sure you want to delete ${selectedFiles.length} files?`,
        async (resolve) => {
          await Promise.all(
            selectedFiles.map((combinedPath) =>
              deleteFetch(projectUuid, combinedPath)
            )
          );
          await reload();
          resolve(true);
          return true;
        }
      );
      return;
    }

    setConfirm(
      "Warning",
      `Are you sure you want to delete '${getBaseNameFromContextMenu(
        contextMenuCombinedPath
      )}'?`,
      async (resolve) => {
        await deleteFetch(projectUuid, contextMenuCombinedPath);
        await reload();
        resolve(true);
        return true;
      }
    );
  }, [
    contextMenuCombinedPath,
    selectedFiles,
    projectUuid,
    reload,
    setConfirm,
    handleClose,
    pipelineIsReadOnly,
  ]);

  const handleDownload = React.useCallback(() => {
    handleClose();

    const downloadLink = getBaseNameFromContextMenu(contextMenuCombinedPath);

    if (selectedFiles.includes(contextMenuCombinedPath)) {
      selectedFiles.forEach((combinedPath, i) => {
        setTimeout(function () {
          downloadFile(baseUrl, combinedPath, downloadLink);
        }, i * 500);
        // Seems like multiple download invocations works with 500ms
        // Not the most reliable, might want to fall back to server side zip.
      });
    } else {
      downloadFile(baseUrl, contextMenuCombinedPath, downloadLink);
    }
  }, [baseUrl, contextMenuCombinedPath, handleClose, selectedFiles]);

  return (
    <FileManagerLocalContext.Provider
      value={{
        baseUrl,
        reload,
        handleClose,
        handleContextMenu,
        handleSelect,
        handleDelete,
        handleDownload,
        handleContextRename,
        contextMenuCombinedPath,
        fileInRename,
        setFileInRename,
        fileRenameNewName,
        setFileRenameNewName,
        setContextMenu,
      }}
    >
      {children}
    </FileManagerLocalContext.Provider>
  );
};
