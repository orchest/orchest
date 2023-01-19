import { useFileApi } from "@/api/files/useFileApi";
import { pipelinesApi } from "@/api/pipelines/pipelinesApi";
import { Code } from "@/components/common/Code";
import { useGlobalContext } from "@/contexts/GlobalContext";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useProjectPipelines } from "@/hooks/useProjectPipelines";
import { siteMap } from "@/routingConfig";
import { downloadFile, unpackPath } from "@/utils/file";
import { Point2D } from "@/utils/geometry";
import { basename } from "@/utils/path";
import { findPipelineFiles } from "@/utils/pipeline";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import React from "react";
import {
  filterRedundantChildPaths,
  prettifyRoot,
} from "../file-manager/common";
import { useFileManagerState } from "../hooks/useFileManagerState";

export type FileManagerLocalContextType = {
  handleClose: () => void;
  handleContextMenu: (
    event: React.MouseEvent,
    combinedPath: string | undefined
  ) => void;
  handleSelect: (
    event: React.SyntheticEvent<Element, Event>,
    selected: string[]
  ) => void;
  handleDelete: () => void;
  handleDownload: () => void;
  handleRename: () => void;
  contextMenuOrigin: Point2D | undefined;
  contextMenuPath: string | undefined;
  fileInRename: string | undefined;
  setFileInRename: React.Dispatch<React.SetStateAction<string | undefined>>;
  fileRenameNewName: string;
  setFileRenameNewName: React.Dispatch<React.SetStateAction<string>>;
  setContextMenuOrigin: React.Dispatch<
    React.SetStateAction<Point2D | undefined>
  >;
};

export const FileManagerLocalContext = React.createContext<
  FileManagerLocalContextType
>({} as FileManagerLocalContextType);

export const useFileManagerLocalContext = (): FileManagerLocalContextType =>
  React.useContext(FileManagerLocalContext);

export const FileManagerLocalContextProvider: React.FC = ({ children }) => {
  const { setConfirm } = useGlobalContext();
  const { pipelineReadOnlyReason } = useProjectsContext().state;
  const { projectUuid, pipelineUuid, navigateTo } = useCustomRoute();
  const pipelines = useProjectPipelines(projectUuid);

  const selectedFiles = useFileManagerState((state) => state.selected);
  const setSelectedFiles = useFileManagerState((state) => state.setSelected);

  // When deleting or downloading selectedFiles, we need to avoid
  // the redundant child paths.
  // e.g. if we delete folder `/a/b`, deleting `/a/b/c.py` should be avoided.
  const selectedFilesWithoutRedundantChildPaths = React.useMemo(() => {
    return filterRedundantChildPaths(selectedFiles);
  }, [selectedFiles]);

  const pipeline = React.useMemo(() => {
    return pipelines?.find((pipeline) => pipeline.uuid === pipelineUuid);
  }, [pipelines, pipelineUuid]);

  const [contextMenuPath, setContextMenuPath] = React.useState<string>();
  const [contextMenuOrigin, setContextMenuOrigin] = React.useState<Point2D>();
  const [fileInRename, setFileInRename] = React.useState<string>();
  const [fileRenameNewName, setFileRenameNewName] = React.useState("");
  const deleteFile = useFileApi((api) => api.delete);

  const handleContextMenu = React.useCallback(
    (event: React.MouseEvent, combinedPath: string | undefined) => {
      event.preventDefault();
      event.stopPropagation();

      setContextMenuOrigin([event.clientX - 2, event.clientY - 4]);
      setContextMenuPath(combinedPath);
    },
    []
  );

  const handleSelect = React.useCallback(
    (event: React.SyntheticEvent<Element, Event>, selected: string[]) => {
      event.stopPropagation();

      setSelectedFiles(selected);
    },
    [setSelectedFiles]
  );

  const handleClose = React.useCallback(() => {
    setContextMenuOrigin(undefined);
  }, [setContextMenuOrigin]);

  const handleRename = React.useCallback(() => {
    if (pipelineReadOnlyReason || !contextMenuPath) return;

    handleClose();
    setFileInRename(contextMenuPath);
    setFileRenameNewName(basename(contextMenuPath));
  }, [contextMenuPath, handleClose, pipelineReadOnlyReason]);

  const handleDelete = React.useCallback(async () => {
    if (pipelineReadOnlyReason || !contextMenuPath || !projectUuid) return;

    handleClose();

    const filesToDelete = selectedFiles.includes(contextMenuPath)
      ? selectedFilesWithoutRedundantChildPaths
      : [contextMenuPath];

    const fileBaseName = basename(filesToDelete[0]);
    const filesToDeleteString =
      filesToDelete.length > 1 ? (
        `${filesToDelete.length} files`
      ) : (
        <Code>{fileBaseName}</Code>
      );

    const pathsThatContainsPipelineFiles = await findPipelineFiles(
      projectUuid,
      filesToDelete.map((combinedPath) => unpackPath(combinedPath))
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
                  <Code>{prettifyRoot(file.root) + file.path}</Code>
                </Box>
              ))}
            </ul>
          </>
        )}
      </Stack>,
      async (resolve) => {
        await Promise.all(
          filesToDelete
            .map(unpackPath)
            .map(({ root, path }) => deleteFile(root, path))
        );
        // Send a GET request for file discovery
        // to ensure that the pipeline is removed from DB.
        await pipelinesApi.fetchForProject(projectUuid);

        const shouldRedirect = filesToDelete.some((fileToDelete) => {
          const { path } = unpackPath(fileToDelete);
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

        resolve(true);
        return true;
      }
    );
  }, [
    pipelineReadOnlyReason,
    contextMenuPath,
    projectUuid,
    handleClose,
    selectedFiles,
    selectedFilesWithoutRedundantChildPaths,
    setConfirm,
    deleteFile,
    pipeline?.path,
    navigateTo,
  ]);

  const handleDownload = React.useCallback(() => {
    if (!contextMenuPath || !projectUuid) return;
    handleClose();

    if (selectedFiles.includes(contextMenuPath)) {
      selectedFilesWithoutRedundantChildPaths
        .map(unpackPath)
        .forEach(({ root, path }, i) => {
          // NOTE:
          //  Seems like multiple download invocations works with 500ms
          //  Not the most reliable, might want to fall back to server side zip.
          setTimeout(() => downloadFile({ root, path, projectUuid }), i * 500);
        });
    } else {
      const { root, path } = unpackPath(contextMenuPath);
      downloadFile({ projectUuid, root, path });
    }
  }, [
    projectUuid,
    contextMenuPath,
    handleClose,
    selectedFiles,
    selectedFilesWithoutRedundantChildPaths,
  ]);

  return (
    <FileManagerLocalContext.Provider
      value={{
        handleClose,
        handleContextMenu,
        handleSelect,
        handleDelete,
        handleDownload,
        handleRename,
        contextMenuPath,
        fileInRename,
        setFileInRename,
        fileRenameNewName,
        setFileRenameNewName,
        setContextMenuOrigin,
        contextMenuOrigin,
      }}
    >
      {children}
    </FileManagerLocalContext.Provider>
  );
};
