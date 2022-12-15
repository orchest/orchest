import { useFileApi } from "@/api/files/useFileApi";
import { useOnClickOutside } from "@/hooks/useOnClickOutside";
import { firstAncestor } from "@/utils/element";
import { combinePath, FileRoot, unpackPath } from "@/utils/file";
import { directoryContents } from "@/utils/file-map";
import { basename, dirname, extname, isDirectory } from "@/utils/path";
import Box from "@mui/material/Box";
import { useTheme } from "@mui/material/styles";
import TextField from "@mui/material/TextField";
import produce from "immer";
import React from "react";
import { useFileManagerLocalContext } from "../contexts/FileManagerLocalContext";
import { usePipelineDataContext } from "../contexts/PipelineDataContext";
import { FileTreeItem } from "./FileTreeItem";

type FileTreeRowProps = {
  path: string;
  root: FileRoot;
  hoveredPath: string | undefined;
  onClick: (filePath: string) => void;
  setDragFile: (dragFileData: { labelText: string; path: string }) => void;
  onRename: (oldPath: string, newPath: string) => void;
  onOpen: (filePath: string) => void;
};

const DOUBLE_CLICK_TIMEOUT = 400;

export const FileTreeRow = ({
  path,
  onRename,
  setDragFile,
  root,
  hoveredPath,
  onOpen,
  onClick,
}: FileTreeRowProps) => {
  const fileMap = useFileApi((api) => api.roots[root] ?? {});
  const { isReadOnly } = usePipelineDataContext();
  const { handleContextMenu, fileInRename } = useFileManagerLocalContext();
  const { directories, files } = React.useMemo(
    () =>
      Object.keys(directoryContents(fileMap, path)).reduce(
        (all, path) =>
          produce(all, (draft) => {
            if (isDirectory(path)) draft.directories.push(path);
            else draft.files.push(path);
          }),
        { directories: [] as string[], files: [] as string[] }
      ),
    [path, fileMap]
  );

  /*
   * NOTE:
   *  The double "onClick" and "onDoubleClick" handlers
   *  can sometimes end up "fighting each other".
   *  It all depends on the time it takes for the side-effects of
   *  the "onClick" handler to run, the timing of the clicks themselves
   *  and when re-rendering occurs along this process.
   *
   *  Keeping track of the "click state" externally gives
   *  us more fine-grained control, and allows us to be more
   *  lenient with how we measure double clicks.
   */

  const clickTimeoutRef = React.useRef<number>();
  const doubleClickThrottleRef = React.useRef<number>();

  const onDoubleClick = (combinedPath: string) => {
    if (doubleClickThrottleRef.current) return;

    window.clearTimeout(clickTimeoutRef.current);
    clickTimeoutRef.current = undefined;

    doubleClickThrottleRef.current = window.setTimeout(
      () => (doubleClickThrottleRef.current = undefined),
      100
    );

    if (isReadOnly) return;

    onOpen(combinedPath);
  };

  const onSingleClick = (combinedPath: string) => {
    if (clickTimeoutRef.current) {
      // There was a click in the last 400ms
      onDoubleClick(combinedPath);
    } else {
      onClick(combinedPath);

      clickTimeoutRef.current = window.setTimeout(
        () => (clickTimeoutRef.current = undefined),
        DOUBLE_CLICK_TIMEOUT
      );
    }
  };

  return (
    <>
      {directories.map((path) => {
        const combinedPath = combinePath({ root, path });

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
              labelText={basename(path)}
            >
              <FileTreeRow
                path={path}
                setDragFile={setDragFile}
                root={root}
                hoveredPath={hoveredPath}
                onClick={onClick}
                onOpen={onOpen}
                onRename={onRename}
              />
            </FileTreeItem>
          </Box>
        );
      })}
      {files.map((path) => {
        const combinedPath = combinePath({ root, path });
        const name = basename(path);

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
              labelText={name}
              fileName={name}
              onClick={() => onSingleClick(combinedPath)}
              onDoubleClick={() => onDoubleClick(combinedPath)}
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
