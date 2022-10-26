import { useFileApi } from "@/api/files/useFileApi";
import { useDebounce } from "@/hooks/useDebounce";
import { useFetchFileRoots } from "@/hooks/useFetchFileRoots";
import { useUploader } from "@/hooks/useUploader";
import { combinePath, fileRoots, unpackPath } from "@/utils/file";
import { isDirectory } from "@/utils/path";
import LinearProgress from "@mui/material/LinearProgress";
import MenuItem from "@mui/material/MenuItem";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { usePipelineDataContext } from "../contexts/PipelineDataContext";
import { ActionBar } from "./ActionBar";
import { getActiveRoot, lastSelectedFolderPath } from "./common";
import { CreatePipelineButton } from "./CreatePipelineButton";
import { FileManagerContainer } from "./FileManagerContainer";
import { useFileManagerContext } from "./FileManagerContext";
import {
  ContextMenuMetadata,
  FileManagerContextMenu,
} from "./FileManagerContextMenu";
import { FileManagerLocalContextProvider } from "./FileManagerLocalContext";
import { FileTree } from "./FileTree";
import { FileTreeContainer } from "./FileTreeContainer";

const START_EXPANDED = ["/project-dir:/"];

export function FileManager() {
  const { projectUuid } = usePipelineDataContext();
  const {
    isDragging,
    selectedFiles,
    setSelectedFiles,
  } = useFileManagerContext();

  const roots = useFetchFileRoots();
  const reload = useFileApi((api) => api.init);
  const expand = useFileApi((api) => api.expand);

  const containerRef = React.useRef<HTMLDivElement | null>(null);

  // only show the progress if it takes longer than 125 ms
  const [_inProgress, setInProgress] = React.useState(false);
  const inProgress = useDebounce(_inProgress, 125);

  const [expanded, setExpanded] = React.useState<string[]>(START_EXPANDED);
  const [progress, setProgress] = React.useState(0);
  const [contextMenu, setContextMenu] = React.useState<ContextMenuMetadata>(
    undefined
  );

  const root = React.useMemo(() => getActiveRoot(selectedFiles), [
    selectedFiles,
  ]);

  const collapseAll = () => {
    setExpanded([]);
    setContextMenu(undefined);
  };

  const selectedFolder = React.useMemo(
    () => lastSelectedFolderPath(selectedFiles),
    [selectedFiles]
  );

  const uploader = useUploader({
    projectUuid,
    root,
    isProjectUpload: false,
  });

  React.useEffect(() => {
    setProgress(uploader.progress);
  }, [uploader.progress]);
  React.useEffect(() => {
    setInProgress(uploader.inProgress);
  }, [uploader.inProgress]);

  const handleToggle = React.useCallback(
    (event: React.SyntheticEvent<Element, Event>, paths: string[]) => {
      if (!isDragging) {
        const newPaths = paths.filter((path) => !expanded.includes(path));

        newPaths.forEach((combinedPath) => {
          const { root, path } = unpackPath(combinedPath);

          if (isDirectory(path)) {
            expand(root, path);
          }
        });

        setExpanded(paths);
      }
    },
    [expand, expanded, isDragging]
  );

  React.useEffect(() => {
    if (Object.keys(roots).length === 0) return;

    const pruneMissingPaths = (paths: string[]) => {
      const filtered = paths
        .map(unpackPath)
        .filter(({ root, path }) => roots[root][path])
        .map(combinePath);

      return filtered.length !== paths.length ? filtered : paths;
    };

    setSelectedFiles(pruneMissingPaths);
    setExpanded(pruneMissingPaths);
  }, [roots, setSelectedFiles]);

  const allTreesHaveLoaded = fileRoots.every((root) => hasValue(roots[root]));

  const onMoved = React.useCallback(
    (oldPath: string, newPath: string) => {
      if (!selectedFiles.includes(newPath)) {
        setSelectedFiles((current) => [...current, newPath]);
      }

      const wasExpandedBeforeMove =
        expanded.includes(oldPath) && !expanded.includes(newPath);

      if (wasExpandedBeforeMove) {
        setExpanded((expanded) => [...expanded, newPath]);
      }
    },
    [expanded, selectedFiles, setSelectedFiles]
  );

  const handleUpload = (files: FileList | File[]) =>
    uploader
      .uploadFiles(selectedFolder, files)
      .then(() => expand(root, selectedFolder));

  return (
    <>
      <FileManagerContainer ref={containerRef} uploadFiles={handleUpload}>
        {inProgress && (
          <LinearProgress
            sx={{ position: "absolute", width: "100%" }}
            value={progress}
            variant="determinate"
          />
        )}
        <FileManagerLocalContextProvider setContextMenu={setContextMenu}>
          <CreatePipelineButton />
          <ActionBar
            setExpanded={setExpanded}
            uploadFiles={handleUpload}
            rootFolder={root}
          />
          <FileTreeContainer>
            {allTreesHaveLoaded && (
              <>
                <FileTree
                  treeRoots={fileRoots}
                  expanded={expanded}
                  onMoved={onMoved}
                  handleToggle={handleToggle}
                />
                <FileManagerContextMenu metadata={contextMenu}>
                  {contextMenu?.type === "background" && (
                    <>
                      <MenuItem dense onClick={collapseAll}>
                        Collapse all
                      </MenuItem>
                      <MenuItem
                        dense
                        onClick={() => {
                          reload();
                          setContextMenu(undefined);
                        }}
                      >
                        Refresh
                      </MenuItem>
                    </>
                  )}
                </FileManagerContextMenu>
              </>
            )}
          </FileTreeContainer>
        </FileManagerLocalContextProvider>
      </FileManagerContainer>
    </>
  );
}
