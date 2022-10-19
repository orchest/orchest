import { useDebounce } from "@/hooks/useDebounce";
import { useUploader } from "@/hooks/useUploader";
import { isDirectory, segments } from "@/utils/path";
import LinearProgress from "@mui/material/LinearProgress";
import MenuItem from "@mui/material/MenuItem";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { treeRoots } from "../common";
import { usePipelineDataContext } from "../contexts/PipelineDataContext";
import { ActionBar } from "./ActionBar";
import {
  combinePath,
  FileTrees,
  findTreeNode,
  getActiveRoot,
  lastSelectedFolderPath,
  replaceTreeNode,
  unpackPath,
} from "./common";
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
  const {
    projectUuid,
    pipelineUuid,
    runUuid,
    jobUuid,
  } = usePipelineDataContext();
  const {
    isDragging,
    selectedFiles,
    setSelectedFiles,
    fileTrees,
    fetchFileTrees,
    browse,
    setFileTrees,
  } = useFileManagerContext();

  const containerRef = React.useRef<HTMLDivElement | null>(null);

  // only show the progress if it takes longer than 125 ms
  const [_inProgress, setInProgress] = React.useState(false);
  const inProgress = useDebounce(_inProgress, 125);

  const [expanded, setExpanded] = React.useState<string[]>(START_EXPANDED);
  const [progress, setProgress] = React.useState(0);
  const [contextMenu, setContextMenu] = React.useState<ContextMenuMetadata>(
    undefined
  );
  const deepestExpandRef = React.useRef(0);

  deepestExpandRef.current = React.useMemo(() => {
    if (expanded.length === 0) return 0;
    else return Math.max(...expanded.map(directoryLevel));
  }, [expanded]);

  const root = React.useMemo(() => getActiveRoot(selectedFiles, treeRoots), [
    selectedFiles,
  ]);

  const reload = React.useCallback(
    async (depth?: number) => {
      setInProgress(true);

      await fetchFileTrees(Math.max(2, depth ?? 0));

      setInProgress(false);
    },
    [fetchFileTrees]
  );

  const collapseAll = () => {
    setExpanded([]);
    setContextMenu(undefined);
  };

  const browsePath = React.useCallback(
    async (combinedPath: string) => {
      if (!projectUuid) return;

      setInProgress(true);

      const { root, path } = unpackPath(combinedPath);
      const existingNode = findTreeNode(fileTrees[root], path);

      // If this node has already been loaded,
      // we don't reload it.
      if (existingNode?.children.length) return;

      const node = await browse(root, path, 1);

      setFileTrees({
        ...fileTrees,
        [root]: replaceTreeNode(fileTrees[root], node),
      });
      setInProgress(false);
    },
    [browse, fileTrees, projectUuid, setFileTrees]
  );

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
          const node = findTreeNode(fileTrees[root], path);

          // Only attempt to load paths if it appears as the node hasn't been fetched.
          if (!node?.children.length && node?.type === "directory") {
            browsePath(combinedPath);
          }
        });

        setExpanded(paths);
      }
    },
    [browsePath, expanded, fileTrees, isDragging]
  );

  React.useEffect(() => {
    if (!projectUuid) return;
    // The below causes a 400:
    if (jobUuid && runUuid && !pipelineUuid) return;

    reload();
  }, [projectUuid, pipelineUuid, runUuid, jobUuid, reload]);

  React.useEffect(() => {
    if (Object.keys(fileTrees).length === 0) return;

    const pruneMissingPaths = (paths: string[]) => {
      const filtered = filterExistingNodes(fileTrees, paths);

      return filtered.length !== paths.length ? filtered : paths;
    };

    setSelectedFiles(pruneMissingPaths);
    setExpanded(pruneMissingPaths);
  }, [fileTrees, setSelectedFiles]);

  const allTreesHaveLoaded = treeRoots.every((root) =>
    hasValue(fileTrees[root])
  );

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
      .then(() => reload(deepestExpandRef.current));

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
        <FileManagerLocalContextProvider
          reload={() => reload(deepestExpandRef.current)}
          setContextMenu={setContextMenu}
        >
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
                  treeRoots={treeRoots}
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

const directoryLevel = (path: string) =>
  segments(path).length - (isDirectory(path) ? 0 : 1);

/** Returns the paths which exist in the provided file trees. */
const filterExistingNodes = (
  fileTrees: FileTrees,
  combinedPaths: string[]
): string[] =>
  combinedPaths
    .map(unpackPath)
    .filter(({ root, path }) => findTreeNode(fileTrees[root], path))
    .map(combinePath);
