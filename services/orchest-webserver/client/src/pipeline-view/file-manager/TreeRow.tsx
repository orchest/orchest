import Box from "@mui/material/Box";
import { useTheme } from "@mui/material/styles";
import TextField from "@mui/material/TextField";
import produce from "immer";
import React from "react";
import {
  createCombinedPath,
  deriveParentPath,
  TreeNode,
  unpackCombinedPath,
} from "./common";
import { useFileManagerLocalContext } from "./FileManagerLocalContext";
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
  } = useFileManagerLocalContext();
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

export const TreeRow = ({
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
  const {
    handleContextMenu,
    fileInRename,
    isReadOnly,
  } = useFileManagerLocalContext();
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
              disableDragging={isReadOnly}
              onContextMenu={(e) => handleContextMenu(e, combinedPath)}
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
              disableDragging={isReadOnly}
              onContextMenu={(e) => handleContextMenu(e, combinedPath)}
              sx={{ cursor: "context-menu" }}
              key={combinedPath}
              nodeId={combinedPath}
              data-path={combinedPath}
              path={combinedPath}
              labelText={e.name}
              fileName={e.name}
              onDoubleClick={() => !isReadOnly && onOpen(combinedPath)}
            />
          </div>
        );
      })}
    </>
  );
};
