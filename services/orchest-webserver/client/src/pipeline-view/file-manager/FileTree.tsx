import { LogoIcon } from "@/components/common/icons/LogoIcon";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { TreeItem, TreeItemProps, TreeView } from "@mui/lab";
import { treeItemClasses } from "@mui/lab/TreeItem";
import Box from "@mui/material/Box";
import { styled, useTheme } from "@mui/material/styles";
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
import { getIcon, SVGFileIcon } from "./SVGFileIcon";

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
          backgroundColor: (theme) => theme.palette.grey[300],
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

              <StyledFSTreeItem
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
              </StyledFSTreeItem>
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
              <StyledFSTreeItem
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

const StyledTreeItemRoot = styled(TreeItem)(({ theme }) => ({
  [`& .${treeItemClasses.content}`]: {
    padding: "0px 4px",
    [`.${treeItemClasses.label}`]: {
      paddingLeft: 0,
      ["div"]: {
        textOverflow: "ellipsis",
        overflow: "hidden",
      },
    },
    "&.Mui-focused, &.Mui-selected, &.Mui-selected.Mui-focused": {
      backgroundColor: `var(--tree-view-bg-color, ${theme.palette.action.selected})`,
      color: "var(--tree-view-color)",
    },
  },
}));

function StyledFSTreeItem({
  fileName,
  path,
  labelText,
  setIsDragging,
  setDragItem,
  ...other
}: TreeItemProps & {
  fileName?: string;
  labelText: string;
  setIsDragging: (value: boolean) => void;
  setDragItem: (dragItemData: { labelText: string; path: string }) => void;
  path: string;
  style: React.CSSProperties;
}) {
  const icon = !fileName ? undefined : fileName.endsWith(".orchest") ? (
    <LogoIcon size={22} />
  ) : (
    getIcon(fileName)
  );

  // const { setIsDragging, setDragItem } = dragHandlers;
  const DRAG_THRESHOLD = 5;

  const [pressed, setPressed] = React.useState(false);
  const [triggeredDragging, setTriggedDragging] = React.useState(false);
  const cumulativeDrag = React.useRef({ drag: 0 });

  const cancelMove = () => {
    setPressed(false);
    setTriggedDragging(false);
    cumulativeDrag.current.drag = 0;
  };

  return (
    <StyledTreeItemRoot
      onMouseDown={() => {
        setPressed(true);
      }}
      onMouseMove={(e) => {
        if (pressed && !triggeredDragging) {
          const normalizedDeltaX = e.movementX / window.devicePixelRatio;
          const normalizedDeltaY = e.movementY / window.devicePixelRatio;
          cumulativeDrag.current.drag +=
            Math.abs(normalizedDeltaX) + Math.abs(normalizedDeltaY);

          if (cumulativeDrag.current.drag > DRAG_THRESHOLD) {
            setIsDragging(true);
            setDragItem({ labelText, path });
            setTriggedDragging(true);
          }
        }
      }}
      onMouseUp={() => {
        cancelMove();
      }}
      onMouseLeave={() => {
        cancelMove();
      }}
      label={
        <Box sx={{ fontSize: (theme) => theme.typography.body2.fontSize }}>
          {fileName && (
            <div
              style={{
                position: "absolute",
                overflow: "hidden",
                height: "20px",
                left: "-22px",
                top: "0px",
              }}
            >
              <SVGFileIcon icon={icon} />
            </div>
          )}
          {labelText}
        </Box>
      }
      sx={{
        padding: "0px",
        "--tree-view-color": (theme) => theme.palette.primary.main,
        "--tree-view-bg-color": (theme) => theme.palette.grey[300],
      }}
      {...other}
    />
  );
}

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

  const isInFileManager = React.useCallback((element) => {
    if (element.classList.contains(FILE_MANAGER_ROOT_CLASS)) {
      return true;
    } else if (element.parentElement) {
      return isInFileManager(element.parentElement);
    } else {
      return false;
    }
  }, []);

  const draggingSelection = React.useMemo(() => {
    if (!dragItem) return false;
    return selected.includes(dragItem.path);
  }, [dragItem, selected]);

  const handleMouseUp = React.useCallback(
    (target: EventTarget) => {
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
      isInFileManager,
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
      handleMouseUp(e.target);
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
              background: (theme) => theme.palette.grey[300],
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
            <StyledFSTreeItem
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
            </StyledFSTreeItem>
          );
        })}
      </TreeView>
    </Box>
  );
};
