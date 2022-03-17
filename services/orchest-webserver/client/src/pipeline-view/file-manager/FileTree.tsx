import { Code } from "@/components/common/Code";
import { useAppContext } from "@/contexts/AppContext";
import { Position } from "@/types";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import TreeView from "@mui/lab/TreeView";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import { fetcher } from "@orchest/lib-utils";
import React from "react";
import {
  baseNameFromPath,
  cleanFilePath,
  deduceRenameFromDragOperation,
  deriveParentPath,
  FILE_MANAGER_ROOT_CLASS,
  generateTargetDescription,
  isFileByExtension,
  PROJECT_DIR_PATH,
  queryArgs,
  ROOT_SEPARATOR,
  TreeNode,
  unpackCombinedPath,
} from "./common";
import { FileTrees, useFileManagerContext } from "./FileManagerContext";
import { useFileManagerLocalContext } from "./FileManagerLocalContext";
import { TreeItem } from "./TreeItem";
import { TreeRow } from "./TreeRow";

const isInFileManager = (element: HTMLElement) => {
  if (element.classList.contains(FILE_MANAGER_ROOT_CLASS)) return true;

  if (element.parentElement) {
    return isInFileManager(element.parentElement);
  }

  return false;
};

const findFileViaPath = (path: string, fileTrees: FileTrees) => {
  // example: /project-dir:/hello-world/folder/my-file.py
  const [root, filePathStr] = path.split(":");
  const filePath = filePathStr.split("/").filter((value) => value !== "");
  let head = fileTrees[root];

  for (let token of filePath) {
    const found = head.children.find((item) => item.name === token);
    if (!found) break;
    head = found;
  }
  return head;
};

const containsFilesByExtension = (extensions: string[], node: TreeNode) => {
  if (node.type === "file") return isFileByExtension(extensions, node.name);
  if (node.type === "directory" && node.children.length === 0) return false;
  for (let child of node.children) {
    if (containsFilesByExtension(extensions, child)) return true;
  }
  return false;
};

export const FileTree = React.memo(function FileTreeComponent({
  baseUrl,
  treeRoots,
  expanded,
  handleToggle,
  onRename,
  reload,
  onDropOutside,
  onOpen,
}: {
  baseUrl: string;
  treeRoots: string[];
  expanded: string[];
  handleToggle: (
    event: React.SyntheticEvent<Element, Event>,
    nodeIds: string[]
  ) => void;
  onRename: (oldPath: string, newPath: string) => void;
  reload: () => void;
  onDropOutside: (target: EventTarget, dropPosition: Position) => void;
  onOpen: (filePath: string) => void;
}) {
  const INIT_OFFSET_X = 10;
  const INIT_OFFSET_Y = 10;

  const { setConfirm, setAlert } = useAppContext();

  const {
    selectedFiles,
    dragFile,
    setDragFile,
    dragOffset,
    setDragOffset,
    hoveredPath,
    setHoveredPath,
    isDragging,
    setIsDragging,
    resetMove,
    fileTrees,
    setFilePathChanges,
  } = useFileManagerContext();
  const { getDropPosition, handleSelect } = useFileManagerLocalContext();

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
        if (!skipReload) {
          setFilePathChanges([{ oldPath, newPath, oldRoot, newRoot }]);
          reload();
        }
        return { oldPath, newPath, oldRoot, newRoot };
      } catch (error) {
        setAlert("Error", `Failed to rename file ${oldPath}. ${error.message}`);
      }
    },
    [onRename, baseUrl, reload, setAlert, setFilePathChanges]
  );

  const handleDropInside = React.useCallback(
    (filePath: string) => {
      // if user attempts to move .ipynb or .orchest files to /data
      if (/^\/data\:/.test(filePath)) {
        const foundPathWithForbiddenFiles = dragFiles.find((dragFilePath) => {
          const foundFile = findFileViaPath(dragFilePath, fileTrees);
          return containsFilesByExtension(["ipynb", "orchest"], foundFile);
        });

        if (foundPathWithForbiddenFiles) {
          setAlert(
            "Warning",
            <Stack spacing={2} direction="column">
              <Box>
                Notebook files (<Code>{".ipynb"}</Code>) or Pipeline files (
                <Code>{".orchest"}</Code>){` are not allowed in `}
                <Code>{"/data"}</Code>.
              </Box>
              <Box>
                Please check the following path:
                <Code>
                  Project files/{cleanFilePath(foundPathWithForbiddenFiles)}
                </Code>
              </Box>
            </Stack>
          );
          return;
        }
      }

      const deducedPaths = dragFiles.map((path) =>
        deduceRenameFromDragOperation(path, filePath)
      );
      const hasPathChanged = deducedPaths.some(
        ([sourcePath, newPath]) => sourcePath !== newPath
      );
      // Check if any path changes
      if (hasPathChanged) {
        let targetDescription = generateTargetDescription(deducedPaths[0][1]);
        const confirmMessage =
          dragFiles.length > 1 ? (
            <>
              {`Do you want move `}
              {dragFiles.length}
              {` files to `}
              {targetDescription} ?
            </>
          ) : (
            <>
              {`Do you want move `}
              <Code>{baseNameFromPath(deducedPaths[0][0])}</Code>
              {` to `}
              {targetDescription} ?
            </>
          );

        setConfirm("Warning", confirmMessage, async (resolve) => {
          const newFilePathChanges = await Promise.all(
            deducedPaths.map(([sourcePath, newPath]) => {
              return handleRename(sourcePath, newPath, true);
            })
          );
          setFilePathChanges(newFilePathChanges);
          reload();
          resolve(true);
          return true;
        });
      }
    },
    [
      dragFiles,
      fileTrees,
      handleRename,
      reload,
      setAlert,
      setConfirm,
      setFilePathChanges,
    ]
  );

  const handleMouseUp = React.useCallback(
    (target: HTMLElement) => {
      // dropped outside of the tree view
      if (!isInFileManager(target)) {
        onDropOutside(target, getDropPosition());
        return;
      }

      let targetFilePath = filePathFromHTMLElement(target);
      if (!targetFilePath) return;

      // dropped inside of the tree view
      if (dragFiles.length > 0) {
        handleDropInside(targetFilePath);
      }
    },
    [
      onDropOutside,
      dragFiles,
      filePathFromHTMLElement,
      getDropPosition,
      handleDropInside,
    ]
  );

  let mouseMoveHandler = React.useCallback(
    (e: MouseEvent) => {
      if (isDragging) {
        let path = filePathFromHTMLElement(e.target);
        if (path) {
          setHoveredPath(!path.endsWith("/") ? deriveParentPath(path) : path);
        }
        setDragOffset({
          x: e.clientX + INIT_OFFSET_X,
          y: e.clientY + INIT_OFFSET_Y,
        });
      }
    },
    [isDragging, setDragOffset, filePathFromHTMLElement, setHoveredPath]
  );

  let mouseLeaveHandler = React.useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (e: MouseEvent) => {
      if (isDragging) resetMove();
    },
    [isDragging, resetMove]
  );

  const triggerHandleMouseUp = React.useCallback(
    (e: MouseEvent) => {
      handleMouseUp(e.target as HTMLElement);
      resetMove();
    },
    [handleMouseUp, resetMove]
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
