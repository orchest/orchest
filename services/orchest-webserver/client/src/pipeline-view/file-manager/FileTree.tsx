import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import TreeView from "@mui/lab/TreeView";
import Box from "@mui/material/Box";
import { useTheme } from "@mui/material/styles";
import TextField from "@mui/material/TextField";
import React from "react";
import {
  baseNameFromPath,
  createCombinedPath,
  deduceRenameFromDragOperation,
  deriveParentPath,
  FILE_MANAGER_ROOT_CLASS,
  generateTargetDescription,
  PROJECT_DIR_PATH,
  ROOT_SEPARATOR,
  TreeNode,
  unpackCombinedPath,
} from "./common";
import { TreeItem } from "./TreeItem";

const RenameField = ({
  fileInRename,
  setFileInRename,
  handleRename,
  fileRenameNewName,
  setFileRenameNewName,
  combinedPath,
}) => {
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
  handleContextMenu,
  handleRename,
  setIsDragging,
  setDragItem,
  root,
  hoveredPath,
  onOpen,
  fileInRename,
  setFileInRename,
  fileRenameNewName,
  setFileRenameNewName,
}: {
  handleContextMenu: (path: string, event: React.MouseEvent) => void;
  treeNodes: TreeNode[];
  handleRename: (oldPath: string, newPath: string) => void;
  setIsDragging: (value: boolean) => void;
  setDragItem: (dragItemData: { labelText: string; path: string }) => void;
  root: string;
  hoveredPath: string;
  onOpen: () => void;
  fileInRename: string;
  setFileInRename: (value: string) => void;
  fileRenameNewName: string;
  setFileRenameNewName: (value: string) => void;
}) => {
  return (
    <>
      {treeNodes
        .filter((e) => e.type === "directory")
        .map((e) => {
          const combinedPath = createCombinedPath(root, e.path);

          return (
            <div style={{ position: "relative" }} key={combinedPath}>
              {fileInRename === combinedPath && (
                <RenameField
                  fileInRename={fileInRename}
                  setFileInRename={setFileInRename}
                  handleRename={handleRename}
                  fileRenameNewName={fileRenameNewName}
                  setFileRenameNewName={setFileRenameNewName}
                  combinedPath={combinedPath}
                />
              )}

              <TreeItem
                onContextMenu={(e) => handleContextMenu(combinedPath, e)}
                setIsDragging={setIsDragging}
                setDragItem={setDragItem}
                style={{
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
                  handleContextMenu={handleContextMenu}
                  treeNodes={e.children}
                  setIsDragging={setIsDragging}
                  setDragItem={setDragItem}
                  root={root}
                  hoveredPath={hoveredPath}
                  onOpen={onOpen}
                  fileInRename={fileInRename}
                  setFileInRename={setFileInRename}
                  fileRenameNewName={fileRenameNewName}
                  setFileRenameNewName={setFileRenameNewName}
                  handleRename={handleRename}
                />
              </TreeItem>
            </div>
          );
        })}
      {treeNodes
        .filter((e) => e.type === "file")
        .map((e) => {
          const combinedPath = createCombinedPath(root, e.path);
          return (
            <div style={{ position: "relative" }} key={combinedPath}>
              {fileInRename === combinedPath && (
                <RenameField
                  fileInRename={fileInRename}
                  setFileInRename={setFileInRename}
                  handleRename={handleRename}
                  fileRenameNewName={fileRenameNewName}
                  setFileRenameNewName={setFileRenameNewName}
                  combinedPath={combinedPath}
                />
              )}
              <TreeItem
                onContextMenu={handleContextMenu.bind(undefined, combinedPath)}
                setIsDragging={setIsDragging}
                setDragItem={setDragItem}
                style={{ cursor: "context-menu" }}
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

export const FileTree = ({
  fileTrees,
  treeRoots,
  expanded,
  handleToggle,
  selected,
  handleSelect,
  handleContextMenu,
  handleRename,
  isDragging,
  setIsDragging,
  onDropOutside,
  onOpen,
  fileInRename,
  setFileInRename,
  fileRenameNewName,
  setFileRenameNewName,
}: {
  fileTrees: Record<string, TreeNode>;
  treeRoots: string[];
  expanded: string[];
  handleToggle: (
    event: React.SyntheticEvent<Element, Event>,
    nodeIds: string[]
  ) => void;
  selected: string[];
  handleSelect: (
    event: React.SyntheticEvent<Element, Event>,
    nodeIds: string[]
  ) => void;
  handleContextMenu: (path: string, e: React.MouseEvent) => void;
  handleRename: (sourcePath: string, newPath: string) => void;
  isDragging: boolean;
  setIsDragging: (value: boolean) => void;
  onDropOutside: (target: EventTarget, selection: string[]) => void;
  onOpen: () => void;
  fileInRename: string;
  setFileInRename: (file: string) => void;
  fileRenameNewName: string;
  setFileRenameNewName: (value: string) => void;
}) => {
  const INIT_OFFSET_X = 10;
  const INIT_OFFSET_Y = 10;

  const [dragItem, setDragItem] = React.useState<{
    labelText: string;
    path: string;
  }>(undefined);
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

  const draggingSelection = React.useMemo(() => {
    if (!dragItem) return false;
    return selected.includes(dragItem.path);
  }, [dragItem, selected]);

  const handleMouseUp = React.useCallback(
    (target: HTMLElement) => {
      // Check if target element is inside file tree app
      if (!isInFileManager(target)) {
        if (onDropOutside) {
          let dropSelection = draggingSelection ? selected : [dragItem.path];
          onDropOutside(target, dropSelection);
        }
      } else {
        let filePath = filePathFromHTMLElement(target);
        if (!filePath) {
          return;
        }

        if (draggingSelection && selected.length > 0) {
          let deducedPaths = selected.map((path) =>
            deduceRenameFromDragOperation(path, filePath)
          );
          // Check if any path changes
          if (
            !deducedPaths
              .map(([sourcePath, newPath]) => sourcePath === newPath)
              .every((x) => x === true)
          ) {
            let targetDescription = generateTargetDescription(
              deducedPaths[0][1]
            );
            const confirmMessage =
              selected.length > 1
                ? `Do you want move ${selected.length} files to ${targetDescription}?`
                : `Do you want move '${baseNameFromPath(
                    deducedPaths[0][0]
                  )}' to ${targetDescription}?`;

            if (window.confirm(confirmMessage)) {
              deducedPaths.forEach(([sourcePath, newPath]) => {
                handleRename(sourcePath, newPath);
              });
            }
          }
        } else {
          let [sourcePath, newPath] = deduceRenameFromDragOperation(
            dragItem.path,
            filePath
          );
          if (sourcePath !== newPath) {
            let targetDescription = generateTargetDescription(newPath);
            if (
              window.confirm(
                `Do you want move '${baseNameFromPath(
                  sourcePath
                )}' to ${targetDescription}?`
              )
            ) {
              handleRename(sourcePath, newPath);
            }
          }
        }
      }
    },
    [
      handleRename,
      selected,
      onDropOutside,
      dragItem,
      draggingSelection,
      filePathFromHTMLElement,
    ]
  );

  const resetMove = React.useCallback(() => {
    // Needs to be delayed to prevent tree toggle
    // while dragging.
    window.setTimeout(() => {
      setDragOffset({
        x: 0,
        y: 0,
      });
      setIsDragging(false);
      setHoveredPath(undefined);
      setDragItem(undefined);
    }, 1);
  }, [setDragOffset, setIsDragging, setDragItem]);

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
    (e: MouseEvent) => {
      if (isDragging) resetMove();
    },
    [isDragging, resetMove]
  );

  let mouseUpHandler = React.useCallback(
    (e: MouseEvent) => {
      if (isDragging) {
        triggerHandleMouseUp(e);
      }
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
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            zIndex: 999,
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
            {draggingSelection
              ? selected.length === 1
                ? baseNameFromPath(selected[0])
                : selected.length
              : dragItem.labelText}
          </Box>
        </div>
      )}
      <TreeView
        aria-label="file system navigator"
        defaultCollapseIcon={<ExpandMoreIcon />}
        defaultExpandIcon={<ChevronRightIcon />}
        expanded={expanded}
        selected={selected}
        onNodeSelect={handleSelect}
        onNodeToggle={handleToggle}
        multiSelect
      >
        {treeRoots.map((root) => {
          let combinedPath = root + ROOT_SEPARATOR + "/";
          return (
            <TreeItem
              fileName={""}
              path={""}
              setIsDragging={(isDragging) => {
                console.log("DEV isDragging: ", isDragging);
              }}
              setDragItem={({ labelText, path }) => {
                console.log("DEV labelText: ", labelText, ", path: ", path);
              }}
              key={root}
              nodeId={root}
              style={{
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
                setDragItem={setDragItem}
                handleContextMenu={handleContextMenu}
                treeNodes={fileTrees[root].children}
                hoveredPath={hoveredPath}
                root={root}
                onOpen={onOpen}
                fileInRename={fileInRename}
                setFileInRename={setFileInRename}
                fileRenameNewName={fileRenameNewName}
                setFileRenameNewName={setFileRenameNewName}
                handleRename={handleRename}
              />
            </TreeItem>
          );
        })}
      </TreeView>
    </Box>
  );
};
