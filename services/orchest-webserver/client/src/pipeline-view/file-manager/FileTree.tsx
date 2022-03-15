import { Code } from "@/components/common/Code";
import { useAppContext } from "@/contexts/AppContext";
import { Position } from "@/types";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import TreeView from "@mui/lab/TreeView";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import { useTheme } from "@mui/material/styles";
import TextField from "@mui/material/TextField";
import { fetcher } from "@orchest/lib-utils";
import produce from "immer";
import React from "react";
import { usePipelineEditorContext } from "../contexts/PipelineEditorContext";
import {
  baseNameFromPath,
  cleanFilePath,
  createCombinedPath,
  deduceRenameFromDragOperation,
  deriveParentPath,
  FILE_MANAGER_ROOT_CLASS,
  generateTargetDescription,
  isNotebookFile,
  PROJECT_DIR_PATH,
  queryArgs,
  ROOT_SEPARATOR,
  TreeNode,
  unpackCombinedPath,
} from "./common";
import { useFileManagerContext } from "./FileManagerContext";
import { TreeItem } from "./TreeItem";

const RenameField = ({
  handleRename,
  combinedPath,
}: {
  handleRename: (oldPath: string, newPath: string) => void;
  combinedPath: string;
}) => {
  const {
    fileInRename,
    setFileInRename,
    fileRenameNewName,
    setFileRenameNewName,
  } = useFileManagerContext();
  const textFieldRef = React.useRef(null);
  const theme = useTheme();

  React.useEffect(() => {
    if (textFieldRef.current) {
      textFieldRef.current.focus();
    }
  }, [fileInRename]);

  return (
    <form
      noValidate
      autoComplete="off"
      onSubmit={(e) => {
        e.preventDefault();
      }}
    >
      <TextField
        sx={{
          position: "absolute",
          zIndex: 9,
          width: "calc(100% - 23px)",
          marginLeft: "23px",
          backgroundColor: (theme) => theme.palette.grey[100],
        }}
        autoFocus
        inputProps={{
          style: { fontSize: theme.typography.body2.fontSize, padding: 0 },
        }}
        inputRef={textFieldRef}
        variant="standard"
        value={fileRenameNewName}
        onKeyDown={(e) => {
          if (e.code === "Escape") {
            setFileInRename(undefined);
          } else if (e.code === "Enter") {
            let isFolder = combinedPath.endsWith("/");
            let { root, path } = unpackCombinedPath(combinedPath);
            let newPath =
              deriveParentPath(path) +
              fileRenameNewName +
              (isFolder ? "/" : "");
            let newCombinedPath = createCombinedPath(root, newPath);
            handleRename(combinedPath, newCombinedPath);
            setFileInRename(undefined);
          }
        }}
        onChange={(e) => {
          setFileRenameNewName(e.target.value);
        }}
      />
    </form>
  );
};

const TreeRow = ({
  treeNodes,
  handleRename,
  setIsDragging,
  setDragFile,
  root,
  hoveredPath,
  onOpen,
}: {
  treeNodes: TreeNode[];
  handleRename: (oldPath: string, newPath: string) => void;
  setIsDragging: (value: boolean) => void;
  setDragFile: (dragFileData: { labelText: string; path: string }) => void;
  root: string;
  hoveredPath: string;
  onOpen: (filePath: string) => void;
}) => {
  const { handleContextMenu, fileInRename } = useFileManagerContext();
  const { directories, files } = React.useMemo(
    () =>
      treeNodes.reduce(
        (all, node) => {
          return produce(all, (draft) => {
            if (node.type === "directory") draft.directories.push(node);
            if (node.type === "file") draft.files.push(node);
          });
        },
        { directories: [], files: [] }
      ),
    [treeNodes]
  );

  return (
    <>
      {directories.map((e) => {
        const combinedPath = createCombinedPath(root, e.path);

        return (
          <Box sx={{ position: "relative" }} key={combinedPath}>
            {fileInRename === combinedPath && (
              <RenameField
                handleRename={handleRename}
                combinedPath={combinedPath}
              />
            )}

            <TreeItem
              onContextMenu={(e) => handleContextMenu(e, combinedPath)}
              setIsDragging={setIsDragging}
              setDragFile={setDragFile}
              sx={{
                cursor: "context-menu",
                backgroundColor:
                  hoveredPath === combinedPath
                    ? "rgba(0, 0, 0, 0.04)"
                    : undefined,
              }}
              key={combinedPath}
              nodeId={combinedPath}
              data-path={combinedPath}
              path={combinedPath}
              labelText={e.name}
            >
              <TreeRow
                treeNodes={e.children}
                setIsDragging={setIsDragging}
                setDragFile={setDragFile}
                root={root}
                hoveredPath={hoveredPath}
                onOpen={onOpen}
                handleRename={handleRename}
              />
            </TreeItem>
          </Box>
        );
      })}
      {files.map((e) => {
        const combinedPath = createCombinedPath(root, e.path);
        return (
          <div style={{ position: "relative" }} key={combinedPath}>
            {fileInRename === combinedPath && (
              <RenameField
                handleRename={handleRename}
                combinedPath={combinedPath}
              />
            )}
            <TreeItem
              onContextMenu={(e) => handleContextMenu(e, combinedPath)}
              setIsDragging={setIsDragging}
              setDragFile={setDragFile}
              sx={{ cursor: "context-menu" }}
              key={combinedPath}
              nodeId={combinedPath}
              data-path={combinedPath}
              path={combinedPath}
              labelText={e.name}
              fileName={e.name}
              onDoubleClick={onOpen.bind(undefined, combinedPath)}
            />
          </div>
        );
      })}
    </>
  );
};

const isInFileManager = (element: HTMLElement) => {
  if (element.classList.contains(FILE_MANAGER_ROOT_CLASS)) return true;

  if (element.parentElement) {
    return isInFileManager(element.parentElement);
  }

  return false;
};

export const FileTree = React.memo(function FileTreeComponent({
  baseUrl,
  fileTrees,
  treeRoots,
  expanded,
  handleToggle,
  onRename,
  reload,
  isDragging,
  setIsDragging,
  onDropOutside,
  onOpen,
}: {
  baseUrl: string;
  fileTrees: Record<string, TreeNode>;
  treeRoots: string[];
  expanded: string[];
  handleToggle: (
    event: React.SyntheticEvent<Element, Event>,
    nodeIds: string[]
  ) => void;
  onRename: (oldPath: string, newPath: string) => void;
  reload: () => void;
  isDragging: boolean;
  setIsDragging: (value: boolean) => void;
  onDropOutside: (
    target: EventTarget,
    selection: string[],
    dropPosition: Position
  ) => void;
  onOpen: (filePath: string) => void;
}) {
  const INIT_OFFSET_X = 10;
  const INIT_OFFSET_Y = 10;

  const { setConfirm, setAlert } = useAppContext();
  const {
    setSelectedFiles,
    selectedFiles,
    dragFile,
    setDragFile,
  } = usePipelineEditorContext();

  const [dragOffset, setDragOffset] = React.useState({ x: 0, y: 0 });
  const [hoveredPath, setHoveredPath] = React.useState(undefined);

  const filePathFromHTMLElement = React.useCallback((element) => {
    let dataPath = element.getAttribute("data-path");
    if (dataPath) {
      return dataPath;
    } else if (element.parentElement) {
      return filePathFromHTMLElement(element.parentElement);
    } else {
      return undefined;
    }
  }, []);

  const dragFiles = React.useMemo(() => {
    if (!dragFile) return [];

    const dragFilesSet = new Set(selectedFiles);
    if (dragFile) dragFilesSet.add(dragFile.path);
    return [...dragFilesSet];
  }, [dragFile, selectedFiles]);

  const { getDropPosition, handleSelect } = useFileManagerContext();

  // by default, handleRename will reload
  // when moving multiple files, we manually call reload after Promise.all
  const handleRename = React.useCallback(
    async (oldCombinedPath, newCombinedPath, skipReload = false) => {
      let { root: oldRoot, path: oldPath } = unpackCombinedPath(
        oldCombinedPath
      );
      let { root: newRoot, path: newPath } = unpackCombinedPath(
        newCombinedPath
      );

      onRename(oldCombinedPath, newCombinedPath);

      const url = `${baseUrl}/rename?${queryArgs({
        oldPath,
        newPath,
        oldRoot,
        newRoot,
      })}`;

      try {
        await fetcher(url, { method: "POST" });
        if (!skipReload) reload();
      } catch (error) {
        setAlert("Error", `Failed to rename file ${oldPath}. ${error.message}`);
      }
    },
    [onRename, baseUrl, reload, setAlert]
  );

  const handleMouseUp = React.useCallback(
    (target: HTMLElement) => {
      // dropped outside of the tree view
      if (!isInFileManager(target)) {
        onDropOutside(target, dragFiles, getDropPosition());
        return;
      }

      let filePath = filePathFromHTMLElement(target);
      if (!filePath) return;

      // dropped inside of the tree view
      if (dragFiles.length > 0) {
        const { allowed, disallowed } = dragFiles.reduce(
          (all, curr) => {
            const changes =
              isNotebookFile(curr) && /^\/data\:/.test(filePath)
                ? { disallowed: [...all.disallowed, curr] }
                : { allowed: [...all.allowed, curr] };

            return { ...all, ...changes };
          },
          { allowed: [] as string[], disallowed: [] as string[] }
        );

        if (disallowed.length > 0) {
          setAlert(
            "Warning",
            <Stack spacing={2} direction="column">
              <Box>
                <Code>{"/data"}</Code> cannot contain Notebook files. The
                following files will remain in their current location:
              </Box>
              <ul>
                {disallowed.map((file) => (
                  <Box key={file}>
                    <Code>{cleanFilePath(file)}</Code>
                  </Box>
                ))}
              </ul>
            </Stack>
          );
        }

        const deducedPaths = allowed.map((path) =>
          deduceRenameFromDragOperation(path, filePath)
        );
        const hasPathChanged = deducedPaths.some(
          ([sourcePath, newPath]) => sourcePath !== newPath
        );
        // Check if any path changes
        if (hasPathChanged) {
          let targetDescription = generateTargetDescription(deducedPaths[0][1]);
          const confirmMessage =
            allowed.length > 1
              ? `Do you want move ${allowed.length} files to ${targetDescription}?`
              : `Do you want move '${baseNameFromPath(
                  deducedPaths[0][0]
                )}' to ${targetDescription}?`;

          setConfirm("Warning", confirmMessage, async (resolve) => {
            await Promise.all(
              deducedPaths.map(([sourcePath, newPath]) => {
                return handleRename(sourcePath, newPath, true);
              })
            );
            reload();
            resolve(true);
            return true;
          });
        }
        return;
      }

      let [sourcePath, newPath] = deduceRenameFromDragOperation(
        dragFile.path,
        filePath
      );
      if (sourcePath !== newPath) {
        let targetDescription = generateTargetDescription(newPath);
        setConfirm(
          "Warning",
          `Do you want move '${baseNameFromPath(
            sourcePath
          )}' to ${targetDescription}?`,
          async (resolve) => {
            await handleRename(sourcePath, newPath);
            resolve(true);
            return true;
          }
        );
      }
    },
    [
      handleRename,
      setConfirm,
      setAlert,
      reload,
      onDropOutside,
      dragFile,
      dragFiles,
      filePathFromHTMLElement,
      getDropPosition,
    ]
  );

  const resetMove = React.useCallback(() => {
    // Needs to be delayed to prevent tree toggle
    // while dragging.
    window.setTimeout(() => {
      setDragOffset({ x: 0, y: 0 });
      setIsDragging(false);
      setHoveredPath(undefined);
      setDragFile(undefined);
    }, 1);
  }, [setDragOffset, setIsDragging, setDragFile]);

  const triggerHandleMouseUp = React.useCallback(
    (e: MouseEvent) => {
      handleMouseUp(e.target as HTMLElement);
      resetMove();
    },
    [handleMouseUp, resetMove]
  );

  let mouseMoveHandler = React.useCallback(
    (e: MouseEvent) => {
      if (isDragging) {
        let path = filePathFromHTMLElement(e.target);
        if (path) {
          if (!path.endsWith("/")) {
            path = deriveParentPath(path);
          }
          setHoveredPath(path);
        }
        setDragOffset({
          x: e.clientX + INIT_OFFSET_X,
          y: e.clientY + INIT_OFFSET_Y,
        });
      }
    },
    [isDragging, setDragOffset, filePathFromHTMLElement]
  );

  let mouseLeaveHandler = React.useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (e: MouseEvent) => {
      if (isDragging) resetMove();
    },
    [isDragging, resetMove]
  );

  let mouseUpHandler = React.useCallback(
    (e: MouseEvent) => {
      if (isDragging) triggerHandleMouseUp(e);
    },
    [isDragging, triggerHandleMouseUp]
  );

  let keyUpHandler = React.useCallback(
    (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        resetMove();
      }
    },
    [resetMove]
  );

  let listenerRefs = React.useRef({
    mouseMoveHandler,
    mouseLeaveHandler,
    mouseUpHandler,
    keyUpHandler,
  });

  React.useEffect(() => {
    let mouseMoveHandlerWrapper = (e: MouseEvent) => {
      listenerRefs.current.mouseMoveHandler(e);
    };
    let mouseLeaveHandlerWrapper = (e: MouseEvent) => {
      listenerRefs.current.mouseLeaveHandler(e);
    };
    let mouseUpHandlerWrapper = (e: MouseEvent) => {
      listenerRefs.current.mouseUpHandler(e);
    };
    let keyUpHandlerWrapper = (e: KeyboardEvent) => {
      listenerRefs.current.keyUpHandler(e);
    };

    document.body.addEventListener("mousemove", mouseMoveHandlerWrapper);
    document.body.addEventListener("mouseleave", mouseLeaveHandlerWrapper);
    document.body.addEventListener("mouseup", mouseUpHandlerWrapper);
    document.body.addEventListener("keyup", keyUpHandlerWrapper);

    return () => {
      document.body.removeEventListener("mousemove", mouseMoveHandlerWrapper);
      document.body.removeEventListener("mouseleave", mouseLeaveHandlerWrapper);
      document.body.removeEventListener("mouseup", mouseUpHandlerWrapper);
      document.body.removeEventListener("keyup", keyUpHandlerWrapper);
    };
  }, []);

  React.useEffect(() => {
    listenerRefs.current.mouseMoveHandler = mouseMoveHandler;
    listenerRefs.current.mouseLeaveHandler = mouseLeaveHandler;
    listenerRefs.current.mouseUpHandler = mouseUpHandler;
    listenerRefs.current.keyUpHandler = keyUpHandler;
  }, [mouseMoveHandler, mouseLeaveHandler, mouseUpHandler, keyUpHandler]);

  return (
    <Box
      onMouseDown={(e) => {
        setDragOffset({
          x: e.clientX + INIT_OFFSET_X,
          y: e.clientY + INIT_OFFSET_Y,
        });
      }}
    >
      {isDragging && (
        <Box
          sx={{ position: "fixed", top: 0, left: 0, zIndex: 999 }}
          style={{
            transform: `translateX(${dragOffset.x}px) translateY(${dragOffset.y}px)`,
          }}
        >
          <Box
            sx={{
              padding: "1px 7px",
              background: (theme) => theme.palette.grey[100],
              color: (theme) => theme.palette.primary.main,
            }}
          >
            {dragFiles.length === 1
              ? baseNameFromPath(dragFiles[0])
              : dragFiles.length}
          </Box>
        </Box>
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
              key={root}
              nodeId={root}
              sx={{
                backgroundColor:
                  hoveredPath === combinedPath
                    ? "rgba(0, 0, 0, 0.04)"
                    : undefined,
              }}
              data-path={combinedPath}
              labelText={root === PROJECT_DIR_PATH ? "Project files" : root}
            >
              <TreeRow
                setIsDragging={setIsDragging}
                setDragFile={setDragFile}
                treeNodes={fileTrees[root].children}
                hoveredPath={hoveredPath}
                root={root}
                onOpen={onOpen}
                handleRename={handleRename}
              />
            </TreeItem>
          );
        })}
      </TreeView>
    </Box>
  );
});
