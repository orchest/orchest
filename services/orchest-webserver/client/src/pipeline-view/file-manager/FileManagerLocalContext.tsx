import { Code } from "@/components/common/Code";
import { useAppContext } from "@/contexts/AppContext";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/Routes";
import { Position } from "@/types";
import React from "react";
import {
  baseNameFromPath,
  FILE_MANAGEMENT_ENDPOINT,
  isFileByExtension,
  queryArgs,
  searchFilePathsByExtension,
  unpackCombinedPath,
} from "./common";
import { useFileManagerContext } from "./FileManagerContext";
import { ContextMenuType } from "./FileManagerContextMenu";

export type FileManagerLocalContextType = {
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
    `${FILE_MANAGEMENT_ENDPOINT}/delete?${queryArgs({
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
  projectUuid: string,
  combinedPath: string,
  downloadLink: string
) => {
  let { root, path } = unpackCombinedPath(combinedPath);

  let downloadUrl = `/async/file-management/download?${queryArgs({
    path,
    root,
    project_uuid: projectUuid,
  })}`;
  const a = document.createElement("a");
  a.href = downloadUrl;
  a.download = downloadLink;
  document.body.appendChild(a);
  a.click();
  a.remove();
};

export const FileManagerLocalContextProvider: React.FC<{
  reload: () => Promise<void>;
  setContextMenu: React.Dispatch<
    React.SetStateAction<{
      position: Position;
      type: ContextMenuType;
    }>
  >;
}> = ({ children, reload, setContextMenu }) => {
  const { setConfirm } = useAppContext();
  const { projectUuid, pipelineUuid, navigateTo } = useCustomRoute();

  const {
    selectedFiles,
    setSelectedFiles,
    pipelines,
  } = useFileManagerContext();

  const pipeline = React.useMemo(() => {
    return pipelines.find((pipeline) => pipeline.uuid === pipelineUuid);
  }, [pipelines, pipelineUuid]);

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

  const handleDelete = React.useCallback(async () => {
    if (pipelineIsReadOnly) return;

    handleClose();

    const filesToDelete = selectedFiles.includes(contextMenuCombinedPath)
      ? selectedFiles
      : [contextMenuCombinedPath];

    const filesToDeleteString =
      filesToDelete.length > 1
        ? `${filesToDelete.length} files`
        : `'${getBaseNameFromContextMenu(filesToDelete[0])}'`;

    const hasPipelineFiles = await Promise.all(
      filesToDelete.map((pathToDelete) => {
        if (isFileByExtension(["orchest"], pathToDelete)) return true;
        let { root, path } = unpackCombinedPath(pathToDelete);
        return searchFilePathsByExtension({
          root,
          projectUuid,
          extensions: ["orchest"],
          path,
        }).then((response) => response.files.length > 0);
      })
    ).then((allResponses) => allResponses.includes(true));

    setConfirm(
      "Warning",
      `Are you sure you want to delete ${filesToDeleteString}?${
        hasPipelineFiles ? (
          <>
            {` Pipeline files `}
            <Code>{`.orchest`}</Code>
            {` will also be deleted and it cannot be undone.`}.
          </>
        ) : (
          ""
        )
      }`,
      async (resolve) => {
        await Promise.all(
          filesToDelete.map((combinedPath) =>
            deleteFetch(projectUuid, combinedPath)
          )
        );

        if (filesToDelete.includes(pipeline?.path)) {
          // redirect back to pipelines
          navigateTo(siteMap.pipelines.path, {
            query: { projectUuid },
          });
          resolve(true);
          return true;
        }

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
    pipeline?.path,
    navigateTo,
  ]);

  const handleDownload = React.useCallback(() => {
    handleClose();

    const downloadLink = getBaseNameFromContextMenu(contextMenuCombinedPath);

    if (selectedFiles.includes(contextMenuCombinedPath)) {
      selectedFiles.forEach((combinedPath, i) => {
        setTimeout(function () {
          downloadFile(projectUuid, combinedPath, downloadLink);
        }, i * 500);
        // Seems like multiple download invocations works with 500ms
        // Not the most reliable, might want to fall back to server side zip.
      });
    } else {
      downloadFile(projectUuid, contextMenuCombinedPath, downloadLink);
    }
  }, [projectUuid, contextMenuCombinedPath, handleClose, selectedFiles]);

  return (
    <FileManagerLocalContext.Provider
      value={{
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
