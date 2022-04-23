import { Code } from "@/components/common/Code";
import { useAppContext } from "@/contexts/AppContext";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/Routes";
import { Position } from "@/types";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import React from "react";
import {
  baseNameFromPath,
  FILE_MANAGEMENT_ENDPOINT,
  filterRedundantChildPaths,
  findPipelineFilePathsWithinFolders,
  getBaseNameFromPath,
  queryArgs,
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

const downloadFile = (
  projectUuid: string,
  combinedPath: string,
  downloadLink: string
) => {
  let { root, path } = unpackCombinedPath(combinedPath);

  let downloadUrl = `${FILE_MANAGEMENT_ENDPOINT}/download?${queryArgs({
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
  const {
    state: { pipelines = [] },
    fetchPipelines,
  } = useProjectsContext();
  const { projectUuid, pipelineUuid, navigateTo } = useCustomRoute();

  const { selectedFiles, setSelectedFiles } = useFileManagerContext();

  // When deleting or downloading selectedFiles, we need to avoid
  // the redundant child paths.
  // e.g. if we delete folder `/a/b`, deleting `/a/b/c.py` should be avoided.
  const selectedFilesWithoutRedundantChildPaths = React.useMemo(() => {
    return filterRedundantChildPaths(selectedFiles);
  }, [selectedFiles]);

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
    dispatch,
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
      ? selectedFilesWithoutRedundantChildPaths
      : [contextMenuCombinedPath];

    const fileBaseName = getBaseNameFromPath(filesToDelete[0]);
    const filesToDeleteString =
      filesToDelete.length > 1 ? (
        `${filesToDelete.length} files`
      ) : (
        <Code>{fileBaseName}</Code>
      );

    const pathsThatContainsPipelineFiles = await findPipelineFilePathsWithinFolders(
      projectUuid,
      filesToDelete.map((combinedPath) => unpackCombinedPath(combinedPath))
    );

    const shouldShowPipelineFilePaths =
      !fileBaseName.endsWith(".orchest") && // Only one file to delete and it is a `.orchest` file
      pathsThatContainsPipelineFiles.length > 0;

    setConfirm(
      "Warning",
      <Stack spacing={2} direction="column">
        <Box>
          {`Are you sure you want to delete `} {filesToDeleteString}
          {` ?`}
        </Box>
        {shouldShowPipelineFilePaths && (
          <>
            <Box>
              Following pipeline files will also be deleted and it cannot be
              undone.
            </Box>
            <ul>
              {pathsThatContainsPipelineFiles.map((file) => (
                <Box key={`${file.root}/${file.path}`}>
                  <Code>{`${
                    file.root === "/project-dir" ? "Project files" : file.root
                  }${file.path}`}</Code>
                </Box>
              ))}
            </ul>
          </>
        )}
      </Stack>,
      async (resolve) => {
        await Promise.all(
          filesToDelete.map((combinedPath) =>
            deleteFetch(projectUuid, combinedPath)
          )
        );
        // Send a GET request for file dicovery
        // to ensure that the pipeline is removed from DB.
        // It's not needed to await it because we don't use the response
        fetchPipelines();

        // Clean up `state.pipelines` is still needed.
        const pipelinePaths = pathsThatContainsPipelineFiles.map(({ path }) =>
          path.replace(/^\//, "")
        );

        dispatch((state) => {
          const updatedPipelines = state.pipelines.filter((pipeline) => {
            return !pipelinePaths.some((path) => pipeline.path === path);
          });
          return { type: "SET_PIPELINES", payload: updatedPipelines };
        });

        const shouldRedirect = filesToDelete.some((fileToDelete) => {
          const { path } = unpackCombinedPath(fileToDelete);
          const pathToDelete = path.replace(/^\//, "");

          const isDeletingPipelineFileDirectly =
            pathToDelete === pipeline?.path;
          const isDeletingParentFolder =
            pathToDelete.endsWith("/") &&
            pipeline?.path.startsWith(pathToDelete);

          return isDeletingPipelineFileDirectly || isDeletingParentFolder;
        });

        if (shouldRedirect) {
          // redirect back to pipelines
          navigateTo(siteMap.pipeline.path, {
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
    selectedFilesWithoutRedundantChildPaths,
    projectUuid,
    reload,
    setConfirm,
    handleClose,
    pipelineIsReadOnly,
    pipeline?.path,
    navigateTo,
    dispatch,
    fetchPipelines,
  ]);

  const handleDownload = React.useCallback(() => {
    handleClose();

    const downloadLink = getBaseNameFromPath(contextMenuCombinedPath);

    if (selectedFiles.includes(contextMenuCombinedPath)) {
      selectedFilesWithoutRedundantChildPaths.forEach((combinedPath, i) => {
        setTimeout(function () {
          downloadFile(projectUuid, combinedPath, downloadLink);
        }, i * 500);
        // Seems like multiple download invocations works with 500ms
        // Not the most reliable, might want to fall back to server side zip.
      });
    } else {
      downloadFile(projectUuid, contextMenuCombinedPath, downloadLink);
    }
  }, [
    projectUuid,
    contextMenuCombinedPath,
    handleClose,
    selectedFiles,
    selectedFilesWithoutRedundantChildPaths,
  ]);

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
