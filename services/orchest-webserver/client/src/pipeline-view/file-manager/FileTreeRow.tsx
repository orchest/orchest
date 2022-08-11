import { useOnClickOutside } from "@/hooks/useOnClickOutside";
import { firstAncestor } from "@/utils/element";
import { basename, dirname, extname, isDirectory } from "@/utils/path";
import Box from "@mui/material/Box";
import { useTheme } from "@mui/material/styles";
import TextField from "@mui/material/TextField";
import produce from "immer";
import React from "react";
import { FileManagementRoot } from "../common";
import { usePipelineDataContext } from "../contexts/PipelineDataContext";
import { combinePath, TreeNode, unpackPath } from "./common";
import { useFileManagerLocalContext } from "./FileManagerLocalContext";
import { FileTreeItem } from "./FileTreeItem";

type FileTreeRowProps = {
  treeNodes: TreeNode[];
  root: FileManagementRoot;
  hoveredPath: string | undefined;
  setDragFile: (dragFileData: { labelText: string; path: string }) => void;
  onRename: (oldPath: string, newPath: string) => void;
  onOpen: (filePath: string) => void;
};

export const FileTreeRow = ({
  treeNodes,
  onRename,
  setDragFile,
  root,
  hoveredPath,
  onOpen,
}: FileTreeRowProps) => {
  const { isReadOnly } = usePipelineDataContext();
  const { handleContextMenu, fileInRename } = useFileManagerLocalContext();
  const { directories, files } = React.useMemo(
    () =>
      treeNodes.reduce(
        (all, node) =>
          produce(all, (draft) => {
            if (node.type === "directory") draft.directories.push(node);
            if (node.type === "file") draft.files.push(node);
          }),
        { directories: [] as TreeNode[], files: [] as TreeNode[] }
      ),
    [treeNodes]
  );

  return (
    <>
      {directories.map((node) => {
        const combinedPath = combinePath({ root, path: node.path });

        return (
          <Box sx={{ position: "relative" }} key={combinedPath}>
            {fileInRename === combinedPath && (
              <RenameField onRename={onRename} combinedPath={combinedPath} />
            )}

            <FileTreeItem
              disableDragging={isReadOnly}
              onContextMenu={(event) => handleContextMenu(event, combinedPath)}
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
              labelText={node.name}
            >
              <FileTreeRow
                treeNodes={node.children}
                setDragFile={setDragFile}
                root={root}
                hoveredPath={hoveredPath}
                onOpen={onOpen}
                onRename={onRename}
              />
            </FileTreeItem>
          </Box>
        );
      })}
      {files.map((node) => {
        const combinedPath = combinePath({ root, path: node.path });

        return (
          <div style={{ position: "relative" }} key={combinedPath}>
            {fileInRename === combinedPath && (
              <RenameField onRename={onRename} combinedPath={combinedPath} />
            )}
            <FileTreeItem
              disableDragging={isReadOnly}
              onContextMenu={(event) => handleContextMenu(event, combinedPath)}
              sx={{ cursor: "context-menu" }}
              key={combinedPath}
              nodeId={combinedPath}
              data-path={combinedPath}
              path={combinedPath}
              labelText={node.name}
              fileName={node.name}
              onDoubleClick={() => !isReadOnly && onOpen(combinedPath)}
            />
          </div>
        );
      })}
    </>
  );
};

const RenameField = ({
  onRename,
  combinedPath,
}: {
  onRename: (oldPath: string, newPath: string) => void;
  combinedPath: string;
}) => {
  const {
    fileInRename,
    setFileInRename,
    fileRenameNewName,
    setFileRenameNewName,
  } = useFileManagerLocalContext();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const theme = useTheme();

  const cancel = () => setFileInRename(undefined);
  const save = () => {
    const isFolder = isDirectory(combinedPath);
    const { root, path } = unpackPath(combinedPath);
    const newPath = dirname(path) + fileRenameNewName + (isFolder ? "/" : "");
    const newCombinedPath = combinePath({ root, path: newPath });

    if (newCombinedPath !== combinedPath) {
      onRename(combinedPath, newCombinedPath);
    } else {
      cancel();
    }
  };

  React.useEffect(() => inputRef.current?.focus(), [fileInRename]);

  React.useEffect(() => {
    const name = basename(combinedPath);
    const ext = extname(name);
    const end = ext ? name.length - ext.length : name.length;

    inputRef.current?.setSelectionRange(0, end, "forward");
  }, [combinedPath]);

  useOnClickOutside(inputRef, (event) => {
    // NOTE:
    //  We never want clicks in modals to trigger a save,
    //  since modals must be clicked to be dismissed.
    //  We leverage that modals don't share the same
    //  mount point as the rest of the app.
    if (sharesMount(inputRef.current, event.target as Element)) {
      save();
    }
  });

  return (
    <TextField
      sx={{
        position: "absolute",
        zIndex: 9,
        width: "calc(100% - 23px)",
        marginLeft: "23px",
        backgroundColor: (theme) => theme.palette.grey[100],
      }}
      autoFocus
      autoComplete="off"
      inputProps={{
        style: { fontSize: theme.typography.body2.fontSize, padding: 0 },
      }}
      inputRef={inputRef}
      variant="standard"
      value={fileRenameNewName}
      onKeyDown={({ code }) => {
        if (code === "Enter") {
          save();
        } else if (code === "Escape") {
          cancel();
        }
      }}
      onChange={({ target }) => setFileRenameNewName(target.value)}
    />
  );
};

const isMountPoint = (element: Element) =>
  element.parentElement?.tagName === "BODY";

const sharesMount = (...[first, ...elements]: readonly (Element | null)[]) => {
  const mountPoint = firstAncestor(first, isMountPoint);

  return elements.every(
    (element) => firstAncestor(element, isMountPoint) === mountPoint
  );
};
