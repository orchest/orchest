import { Code } from "@/components/common/Code";
import { useAppContext } from "@/contexts/AppContext";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useSessionsContext } from "@/contexts/SessionsContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { fetchPipelines } from "@/hooks/useFetchPipelines";
import { siteMap } from "@/routingConfig";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import TreeView from "@mui/lab/TreeView";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import { fetcher, HEADER } from "@orchest/lib-utils";
import React from "react";
import { FileManagementRoot } from "../common";
import { useOpenNoteBook } from "../hooks/useOpenNoteBook";
import {
  baseNameFromPath,
  cleanFilePath,
  deriveParentPath,
  FileTrees,
  FILE_MANAGEMENT_ENDPOINT,
  FILE_MANAGER_ROOT_CLASS,
  filterRedundantChildPaths,
  findFilesByExtension,
  findPipelineFiles,
  generateTargetDescription,
  getBaseNameFromPath,
  getMoveFromDrop,
  isCombinedPath,
  isInDataFolder,
  isInProjectFolder,
  isPipelineFile,
  Move,
  pathFromElement,
  prettifyRoot,
  queryArgs,
  ROOT_SEPARATOR,
  UnpackedPath,
  unpackMove,
  unpackPath,
} from "./common";
import { DragIndicator } from "./DragIndicator";
import { useFileManagerContext } from "./FileManagerContext";
import { useFileManagerLocalContext } from "./FileManagerLocalContext";
import { TreeItem } from "./TreeItem";
import { TreeRow } from "./TreeRow";

const isInFileManager = (element?: HTMLElement | null): boolean =>
  (element && element.classList.contains(FILE_MANAGER_ROOT_CLASS)) ||
  isInFileManager(element?.parentElement);

/**
 * Finds the node with the specified path-
 * @param combinedPath The combined path, e.g: `/project-dir:/foo/bar.py`
 */
const findNode = (combinedPath: string, fileTrees: FileTrees) => {
  const { root, path } = unpackPath(combinedPath);
  const segments = path.split("/").filter(Boolean);
  let head = fileTrees[root];

  for (const segment of segments) {
    const node = head.children.find(({ name }) => name === segment);

    if (!node) {
      break;
    }

    head = node;
  }

  return head;
};

export const movePipeline = async (
  projectUuid: string,
  pipelineUuid: string,
  move: Move
) => {
  const { newPath } = unpackMove(move);

  await fetcher(`/async/pipelines/${projectUuid}/${pipelineUuid}`, {
    method: "PUT",
    headers: HEADER.JSON,
    body: JSON.stringify({ path: newPath.replace(/^\//, "") }), // The path should be relative to `/project-dir:/`.
  });
};

export const moveFile = async (projectUuid: string, move: Move) => {
  const query = queryArgs({ ...unpackMove(move), projectUuid });

  await fetcher(`${FILE_MANAGEMENT_ENDPOINT}/rename?${query}`, {
    method: "POST",
  });
};

export type FileTreeProps = {
  treeRoots: readonly FileManagementRoot[];
  expanded: string[];
  handleToggle: (
    event: React.SyntheticEvent<Element, Event>,
    nodeIds: string[]
  ) => void;
  onMoved: (oldPath: string, newPath: string) => void;
};

export type LockedFile = UnpackedPath & {
  pipelineUuid: string;
};

export const FileTree = React.memo(function FileTreeComponent({
  treeRoots,
  expanded,
  handleToggle,
  onMoved,
}: FileTreeProps) {
  const { setConfirm, setAlert } = useAppContext();
  const { projectUuid, pipelineUuid, navigateTo } = useCustomRoute();
  const { getSession, stopSession } = useSessionsContext();
  const {
    state: { pipelines = [] },
    dispatch,
  } = useProjectsContext();
  const {
    selectedFiles,
    dragFile,
    setDragFile,
    hoveredPath,
    isDragging,
    fileTrees,
  } = useFileManagerContext();

  const { handleSelect, reload } = useFileManagerLocalContext();

  const openNotebook = useOpenNoteBook();

  const getPipelineFromPath = React.useCallback(
    (path) => {
      path = isCombinedPath(path) ? unpackPath(path).path : path;

      return pipelines.find(
        (pipeline) => pipeline.path === path.replace(/^\//, "")
      );
    },
    [pipelines]
  );

  const onOpen = React.useCallback(
    (path: string) => {
      if (pipelines.length === 0) {
        setAlert(
          "Notice",
          "In order to open a file in JupyterLab, you need to create a pipeline first."
        );
        return;
      }

      if (isInDataFolder(path)) {
        setAlert(
          "Notice",
          <>
            This file cannot be opened from within <Code>/data</Code>. Please
            move it to <Code>Project files</Code>.
          </>
        );
        return;
      }

      const foundPipeline = isPipelineFile(path)
        ? getPipelineFromPath(path)
        : null;

      if (foundPipeline && foundPipeline.uuid !== pipelineUuid) {
        setConfirm(
          "Confirm",
          <>
            Are you sure you want to open pipeline <b>{foundPipeline.name}</b>?
          </>,
          {
            onConfirm: async (resolve) => {
              navigateTo(siteMap.pipeline.path, {
                query: { projectUuid, pipelineUuid: foundPipeline.uuid },
              });
              resolve(true);
              return true;
            },
            onCancel: async (resolve) => {
              resolve(false);
              return false;
            },
            confirmLabel: "Open pipeline",
            cancelLabel: "Cancel",
          }
        );
        return;
      }

      if (foundPipeline && foundPipeline.uuid === pipelineUuid) {
        setAlert("Notice", "This pipeline is already open.");
        return;
      }

      openNotebook(undefined, cleanFilePath(path));
    },
    [
      getPipelineFromPath,
      pipelines,
      projectUuid,
      pipelineUuid,
      setAlert,
      setConfirm,
      navigateTo,
      openNotebook,
    ]
  );

  const draggedFiles = React.useMemo(() => {
    if (!dragFile) {
      return [];
    } else if (!selectedFiles.includes(dragFile.path)) {
      return [dragFile.path];
    } else {
      return filterRedundantChildPaths(selectedFiles);
    }
  }, [dragFile, selectedFiles]);

  const getFilesLockedBySessions = React.useCallback(
    async (projectUuid: string, paths: string[]): Promise<LockedFile[]> => {
      if (!projectUuid) {
        return [];
      }

      const pipelineFiles = await findPipelineFiles(
        projectUuid,
        paths.map(unpackPath)
      );

      const lockedFiles: LockedFile[] = [];

      for (const { path, root } of pipelineFiles) {
        const pipelineUuid = getPipelineFromPath(path)?.uuid;

        if (!pipelineUuid) {
          continue;
        }

        const session = getSession(pipelineUuid);

        if (!session) {
          continue;
        }

        lockedFiles.push({ path, root, pipelineUuid });
      }

      return lockedFiles;
    },
    [getSession, getPipelineFromPath]
  );

  const handleMove = React.useCallback(
    async ([oldPath, newPath]: Move) => {
      try {
        if (!projectUuid) return;

        const movedPipelineWithinProject =
          isPipelineFile(oldPath) &&
          isInProjectFolder(oldPath) &&
          isInProjectFolder(newPath);

        if (movedPipelineWithinProject) {
          const pipeline = getPipelineFromPath(oldPath);

          if (pipeline) {
            await movePipeline(projectUuid, pipeline.uuid, [oldPath, newPath]);
          }
        } else {
          await moveFile(projectUuid, [oldPath, newPath]);
        }
      } catch (error) {
        setAlert(
          "Error",
          <>
            {`Failed to move file `}
            <Code>{cleanFilePath(oldPath, "Project files/")}</Code>
            {`. ${error?.message || ""}`}
          </>
        );
      }
    },
    [getPipelineFromPath, setAlert, projectUuid]
  );

  const afterMove = React.useCallback(
    async (moves: readonly Move[]) => {
      await reload();

      moves.forEach(([oldPath, newPath]) => onMoved(oldPath, newPath));

      const didMovePipeline = moves.some(
        ([oldPath, newPath]) =>
          isPipelineFile(oldPath) || isPipelineFile(newPath)
      );

      if (didMovePipeline && projectUuid) {
        const newPipelines = await fetchPipelines(projectUuid);

        dispatch({
          type: "SET_PIPELINES",
          payload: newPipelines,
        });
      }
    },
    [onMoved, projectUuid, dispatch, reload]
  );

  const moveFiles = React.useCallback(
    async (moves: readonly Move[]) => {
      if (!projectUuid) return;

      const lockedFiles = await getFilesLockedBySessions(
        projectUuid,
        moves.map(([oldPath]) => oldPath)
      );

      const overwrites = moves
        .filter(
          ([, newPath]) =>
            findNode(newPath, fileTrees).name === getBaseNameFromPath(newPath)
        )
        .map(([, newPath]) => newPath);

      const isRename =
        moves.length === 1 &&
        deriveParentPath(moves[0][0]) === deriveParentPath(moves[0][1]);

      if (overwrites.length) {
        setAlert(
          isRename ? "Rename cancelled" : "Move cancelled",
          <OverwriteMessage files={overwrites} />,
          {
            confirmLabel: "OK",
            onConfirm: () => true,
          }
        );
      } else if (lockedFiles.length) {
        setConfirm(
          "Warning",
          <StopSessionMessage files={lockedFiles} isRename={isRename} />,
          {
            confirmLabel: isRename ? "Stop session" : "Stop sessions",
            onConfirm: async (resolve) => {
              await Promise.all(
                lockedFiles.map(({ pipelineUuid }) => stopSession(pipelineUuid))
              );
              resolve(true);
              return true;
            },
          }
        );
      } else {
        const willBrickSomeFile =
          isInDataFolder(moves[0][1]) &&
          (
            await Promise.all(
              draggedFiles.map((path) =>
                findFilesByExtension({
                  root: "/project-dir",
                  node: findNode(path, fileTrees),
                  extensions: ["ipynb", "orchest"],
                  projectUuid,
                })
              )
            )
          ).some((files) => files.length);

        const message = willBrickSomeFile ? (
          <BrickFileMessage />
        ) : (
          <ConfirmMoveMessage moves={moves} />
        );

        if (isRename) {
          await Promise.all(moves.map(handleMove));
          afterMove(moves);
        } else {
          setConfirm("Warning", message, {
            onConfirm: async (resolve) => {
              await Promise.all(moves.map(handleMove));
              afterMove(moves);
              resolve(true);
              return true;
            },
          });
        }
      }
    },
    [
      projectUuid,
      getFilesLockedBySessions,
      fileTrees,
      setAlert,
      setConfirm,
      stopSession,
      draggedFiles,
      handleMove,
      afterMove,
    ]
  );

  const handleDrop = React.useCallback(
    async (targetPath: string) => {
      if (!projectUuid) return;

      const moves = draggedFiles
        .map((sourcePath) => getMoveFromDrop(sourcePath, targetPath))
        .filter(([oldPath, newPath]) => oldPath !== newPath);

      await moveFiles(moves);
    },
    [draggedFiles, projectUuid, moveFiles]
  );

  const handleMouseUp = React.useCallback(
    (target: HTMLElement) => {
      if (!isInFileManager(target)) {
        // dropped outside of the tree view
        // PipelineViewport will take care of the operation
        return;
      }

      const newPath = pathFromElement(target);

      if (newPath && draggedFiles.length > 0) {
        handleDrop(newPath);
      }
    },
    [draggedFiles, handleDrop]
  );

  return (
    <>
      {isDragging && (
        <DragIndicator dragFiles={draggedFiles} handleMouseUp={handleMouseUp} />
      )}
      <TreeView
        aria-label="file system navigator"
        defaultCollapseIcon={<ExpandMoreIcon />}
        defaultExpandIcon={<ChevronRightIcon />}
        expanded={expanded}
        selected={selectedFiles}
        onNodeSelect={handleSelect}
        onNodeToggle={handleToggle}
        multiSelect
      >
        {treeRoots.map((root) => {
          let combinedPath = `${root}${ROOT_SEPARATOR}/`;
          return (
            <TreeItem
              disableDragging
              key={root}
              nodeId={root}
              sx={{
                backgroundColor:
                  hoveredPath === combinedPath
                    ? "rgba(0, 0, 0, 0.04)"
                    : undefined,
              }}
              data-path={combinedPath}
              labelText={prettifyRoot(root)}
            >
              <TreeRow
                setDragFile={setDragFile}
                treeNodes={fileTrees[root].children}
                hoveredPath={hoveredPath}
                root={root}
                onOpen={onOpen}
                onRename={(oldPath, newPath) => moveFiles([[oldPath, newPath]])}
              />
            </TreeItem>
          );
        })}
      </TreeView>
    </>
  );
});

const OverwriteMessage = ({ files }: { files: readonly string[] }) => (
  <Stack spacing={2} direction="column">
    <Box>
      {files.map((path) => (
        <Code key={path}>{cleanFilePath(path, "Project files/")}</Code>
      ))}{" "}
      would be overwritten.
    </Box>
    <Box>
      Move or delete {files.length > 1 ? "these files" : "this file"} first, and
      try again.
    </Box>
  </Stack>
);

const BrickFileMessage = () => (
  <Stack spacing={2} direction="column">
    <Box>
      You are trying to move <Code>{".ipynb"}</Code>
      {` or `}
      <Code>{".orchest"}</Code>
      {` files into `}
      <Code>{"/data"}</Code> folder.
    </Box>
    <Box>
      {`Please note that these files cannot be opened within `}
      <Code>{"/data"}</Code>. Do you want to proceed?
    </Box>
  </Stack>
);

const StopSessionMessage = ({
  files,
  isRename,
}: {
  files: readonly LockedFile[];
  isRename: boolean;
}) => (
  <Stack spacing={2} direction="column">
    <Box>
      {isRename
        ? "You are renaming a pipeline file. " +
          "Its session will have to be stopped before proceeding"
        : "You are moving pipeline files. " +
          "Their sessions have to be stopped before proceeding"}
      Do you want to proceed?
    </Box>
    <ul>
      {files.map(({ path }) => (
        <Box key={path}>
          <Code>{`Project files${path}`}</Code>
        </Box>
      ))}
    </ul>
  </Stack>
);

const ConfirmMoveMessage = ({ moves }: { moves: readonly Move[] }) => (
  <>
    {`Do you want move `}
    {moves.length > 1 ? (
      `${moves.length} files`
    ) : (
      <Code>{baseNameFromPath(moves[0][0])}</Code>
    )}
    {` to `}
    {generateTargetDescription(moves[0][1])} ?
  </>
);
