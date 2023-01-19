import { useFileApi } from "@/api/files/useFileApi";
import { usePipelinesApi } from "@/api/pipelines/usePipelinesApi";
import { Code } from "@/components/common/Code";
import { useGlobalContext } from "@/contexts/GlobalContext";
import { useSessionsContext } from "@/contexts/SessionsContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useProjectPipelines } from "@/hooks/useProjectPipelines";
import { siteMap } from "@/routingConfig";
import { firstAncestor } from "@/utils/element";
import {
  combinePath,
  FileRoot,
  isCombinedPath,
  isInDataFolder,
  isInProjectFolder,
  isPipelineFile,
  isRename,
  Move,
  UnpackedPath,
  unpackMove,
  unpackPath,
} from "@/utils/file";
import { basename, dirname, trimLeadingSlash } from "@/utils/path";
import { findPipelineFiles } from "@/utils/pipeline";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import TreeView from "@mui/lab/TreeView";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import { fetcher, hasValue, HEADER } from "@orchest/lib-utils";
import React from "react";
import { useFileManagerLocalContext } from "../contexts/FileManagerLocalContext";
import { useFileManagerState } from "../hooks/useFileManagerState";
import { useOpenFile } from "../hooks/useOpenFile";
import {
  cleanFilePath,
  FILE_MANAGER_ROOT_CLASS,
  filterRedundantChildPaths,
  getMoveFromDrop,
  pathFromElement,
  prettifyRoot,
} from "./common";
import { DragIndicator } from "./DragIndicator";
import { useFileManagerContext } from "./FileManagerContext";
import { FileTreeItem } from "./FileTreeItem";
import { FileTreeRow } from "./FileTreeRow";

export type FileTreeProps = {
  treeRoots: readonly FileRoot[];
  expanded: string[];
  onSelect: (combinedPath: string) => void;
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
  onSelect,
  onMoved,
}: FileTreeProps) {
  const { setConfirm, setAlert } = useGlobalContext();
  const { projectUuid, navigateTo } = useCustomRoute();
  const { getSession, stopSession } = useSessionsContext();
  const selectedFiles = useFileManagerState((state) => state.selected);
  const {
    dragFile,
    setDragFile,
    hoveredPath,
    isDragging,
  } = useFileManagerContext();
  const extensionSearch = useFileApi((api) => api.extensionSearch);
  const roots = useFileApi((api) => api.roots);
  const reload = useFileApi((api) => api.refresh);
  const moveFile = useFileApi((api) => api.move);
  const fetchPipelines = usePipelinesApi((api) => api.fetchForProject);

  const {
    handleSelect,
    setFileInRename,
    handleContextMenu,
  } = useFileManagerLocalContext();

  const { openInJupyterLab } = useOpenFile();
  const pipelines = useProjectPipelines(projectUuid);

  const pipelineByPath = React.useCallback(
    (path) => {
      path = isCombinedPath(path) ? unpackPath(path).path : path;

      return pipelines?.find(
        (pipeline) => pipeline.path === trimLeadingSlash(path)
      );
    },
    [pipelines]
  );

  const onOpen = React.useCallback(
    (path: string) => {
      if (!pipelines?.length) {
        setAlert(
          "Notice",
          "In order to open a file in JupyterLab, you need to create a pipeline first."
        );
      } else if (isInDataFolder(path)) {
        setAlert(
          "Notice",
          <>
            This file cannot be opened from within <Code>/data</Code>. Please
            move it to <Code>Project files</Code>.
          </>
        );
      } else if (isPipelineFile(path)) {
        const pipelineUuid = pipelineByPath(path)?.uuid;

        if (pipelineUuid) {
          navigateTo(siteMap.pipeline.path, {
            query: { projectUuid, pipelineUuid },
          });
        }
      } else {
        openInJupyterLab(cleanFilePath(path));
      }
    },
    [
      pipelineByPath,
      pipelines,
      projectUuid,
      setAlert,
      navigateTo,
      openInJupyterLab,
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

  const getFilesLockedBySession = React.useCallback(
    async (paths: string[]): Promise<LockedFile[]> => {
      if (!projectUuid) {
        return [];
      }

      const pipelineFiles = await findPipelineFiles(
        projectUuid,
        paths.map(unpackPath)
      );

      const lockedFiles: LockedFile[] = [];

      for (const { path, root } of pipelineFiles) {
        const pipelineUuid = pipelineByPath(path)?.uuid;

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
    [getSession, pipelineByPath, projectUuid]
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
          const pipeline = pipelineByPath(oldPath);

          if (pipeline) {
            await movePipeline(projectUuid, pipeline.uuid, [oldPath, newPath]);
          }
        } else {
          await moveFile(unpackMove([oldPath, newPath]));
        }

        onMoved(oldPath, newPath);
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
    [projectUuid, onMoved, pipelineByPath, moveFile, setAlert]
  );

  const saveMoves = React.useCallback(
    async (moves: readonly Move[]) => {
      await Promise.all(moves.map(handleMove));

      const didMovePipeline = moves.some(
        ([oldPath, newPath]) =>
          isPipelineFile(oldPath) || isPipelineFile(newPath)
      );

      if (didMovePipeline && projectUuid) {
        // Re-fetch pipelines to force the back-end
        // to re-discover pipelines from .orchest files
        // before performing a reload.

        await fetchPipelines(projectUuid).catch();
      }

      await reload();
    },
    [handleMove, projectUuid, reload, fetchPipelines]
  );

  const checks = React.useMemo(
    () => ({
      lockedFiles: (moves: readonly Move[]) =>
        new Promise<boolean>(async (resolve) => {
          const lockedFiles = await getFilesLockedBySession(
            moves.map(([oldPath]) => oldPath)
          );

          if (!lockedFiles.length) {
            resolve(true);
          } else {
            setConfirm(
              "Warning",
              <StopSessionMessage
                files={lockedFiles}
                isRename={isRename(moves)}
              />,
              {
                confirmLabel:
                  lockedFiles.length === 1 ? "Stop session" : "Stop sessions",
                onCancel: () => resolve(false),
                onConfirm: async () => {
                  resolve(false);
                  await Promise.all(
                    lockedFiles.map(({ pipelineUuid }) =>
                      stopSession(pipelineUuid)
                    )
                  );
                  return true;
                },
              }
            );
          }
        }),
      confirm: (moves: readonly Move[]) =>
        new Promise<boolean>(async (resolve) => {
          const overwrites = moves
            .map(unpackMove)
            .filter(({ newRoot, newPath }) =>
              hasValue(roots[newRoot]?.[newPath])
            )
            .map(
              ({ oldRoot, oldPath, newRoot, newPath }) =>
                [
                  combinePath({ root: oldRoot, path: oldPath }),
                  combinePath({ root: newRoot, path: newPath }),
                ] as Move
            );

          if (overwrites.length) {
            setConfirm(
              overwrites.length === 1
                ? `File ${basename(overwrites[0][1])} already exists`
                : `Files already exist`,
              <OverwriteMessage
                overwrites={overwrites}
                isRename={isRename(moves)}
              />,
              {
                confirmLabel: "Overwrite",
                onCancel: () => resolve(false),
                onConfirm: () => {
                  resolve(true);
                  return true;
                },
              }
            );
          } else if (!isRename(moves)) {
            setConfirm("Warning", <ConfirmMoveMessage moves={moves} />, {
              confirmLabel: "Move " + (moves.length === 1 ? "file" : "files"),
              onCancel: () => resolve(false),
              onConfirm: () => {
                resolve(true);
                return true;
              },
            });
          } else {
            resolve(true);
          }
        }),
      breakages: (moves: readonly Move[]) =>
        new Promise<boolean>(async (resolve) => {
          const willBreakSomeFile =
            isInDataFolder(moves[0][1]) &&
            (
              await Promise.all(
                moves.map(([oldPath]) =>
                  extensionSearch({
                    root: "/project-dir",
                    path: oldPath,
                    extensions: ["ipynb", "orchest"],
                  })
                )
              )
            ).some((files) => files.length);

          if (willBreakSomeFile) {
            setConfirm("File type warning", <BreakFileMessage />, {
              confirmLabel: "Move " + (moves.length === 1 ? "file" : "files"),
              onCancel: () => resolve(false),
              onConfirm: () => {
                resolve(true);
                return true;
              },
            });
          } else {
            resolve(true);
          }
        }),
    }),
    [getFilesLockedBySession, setConfirm, stopSession, roots, extensionSearch]
  );

  const handleMoves = React.useCallback(
    async (moves: readonly Move[]) => {
      if (!moves?.length) return;

      for (const check of Object.values(checks)) {
        if (!(await check(moves))) {
          setFileInRename(undefined);
          return;
        }
      }

      await saveMoves(moves);
    },
    [saveMoves, checks, setFileInRename]
  );

  const handleDrop = React.useCallback(
    async (targetPath: string) => {
      if (!projectUuid) return;

      const moves = draggedFiles
        .map((sourcePath) => getMoveFromDrop(sourcePath, targetPath))
        .filter(([oldPath, newPath]) => oldPath !== newPath);

      await handleMoves(moves);
    },
    [draggedFiles, projectUuid, handleMoves]
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
        onNodeSelect={(event, selected) => {
          // See: FIXME in FileTreeItem.tsx
          if (event.type === "IGNORE") return;

          handleSelect(event, selected);
        }}
        onNodeToggle={handleToggle}
        multiSelect
      >
        {treeRoots.map((root) => {
          const combinedPath = combinePath({ root, path: "/" });

          return (
            <FileTreeItem
              disableDragging
              key={root}
              nodeId={combinedPath}
              sx={{
                backgroundColor:
                  hoveredPath === combinedPath
                    ? "rgba(0, 0, 0, 0.04)"
                    : undefined,
              }}
              data-path={combinedPath}
              onContextMenu={(event) => handleContextMenu(event, combinedPath)}
              labelText={prettifyRoot(root)}
            >
              <FileTreeRow
                setDragFile={setDragFile}
                path="/"
                hoveredPath={hoveredPath}
                root={root}
                onOpen={onOpen}
                onClick={onSelect}
                onRename={(oldPath, newPath) =>
                  handleMoves([[oldPath, newPath]])
                }
              />
            </FileTreeItem>
          );
        })}
      </TreeView>
    </>
  );
});

const OverwriteMessage = ({
  overwrites,
  isRename,
}: {
  overwrites: readonly Move[];
  isRename: boolean;
}) => {
  const last = overwrites[overwrites.length - 1];

  return (
    <Stack spacing={2} direction="column">
      {isRename ? (
        <Box>
          {"Renaming "}
          <Code>{basename(overwrites[0][0])}</Code>
          {" to "}
          <Code>{basename(overwrites[0][1])}</Code>{" "}
          {" will overwrite the existing file. Would you like to do this?"}
        </Box>
      ) : (
        <Box>
          {"This move will overwrite "}
          {overwrites.slice(0, -1).map(([, newPath], i) => (
            <>
              <Code key={newPath}>{basename(newPath)}</Code>
              {i === overwrites.length - 2 ? "" : ", "}
            </>
          ))}
          {last ? (
            <>
              {overwrites.length > 1 ? " and " : ""}
              <Code key={last[1]}>{basename(last[1])}</Code>
            </>
          ) : null}
          {"."}
          <br />
          {"Would you like to do this?"}
        </Box>
      )}
    </Stack>
  );
};

const BreakFileMessage = () => (
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
          "Its session will have to be stopped before proceeding. "
        : "You are moving pipeline files. " +
          "Their sessions have to be stopped before proceeding. "}
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
    {"Do you want to move "}
    {moves.length > 1 ? (
      `${moves.length} files`
    ) : (
      <Code>{basename(moves[0][0])}</Code>
    )}
    {" to "}
    <Code>{prettifyRoot(basename(dirname(moves[0][1])))}</Code> ?
  </>
);

const isInFileManager = (element?: HTMLElement | null): boolean =>
  !!firstAncestor(element, ({ classList }) =>
    classList.contains(FILE_MANAGER_ROOT_CLASS)
  );

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
