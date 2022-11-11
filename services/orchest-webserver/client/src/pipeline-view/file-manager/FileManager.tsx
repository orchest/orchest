import { useFileApi } from "@/api/files/useFileApi";
import { useDebounce } from "@/hooks/useDebounce";
import { useFetchFileRoots } from "@/hooks/useFetchFileRoots";
import { useUploader } from "@/hooks/useUploader";
import { combinePath, FileRoot, fileRoots, unpackPath } from "@/utils/file";
import { Point2D } from "@/utils/geometry";
import { dirname, isDirectory, nearestDirectory } from "@/utils/path";
import LinearProgress from "@mui/material/LinearProgress";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { usePipelineDataContext } from "../contexts/PipelineDataContext";
import { ActionBar } from "./ActionBar";
import { CreatePipelineButton } from "./CreatePipelineButton";
import { FileManagerContainer } from "./FileManagerContainer";
import { useFileManagerContext } from "./FileManagerContext";
import { FileManagerContextMenu } from "./FileManagerContextMenu";
import { FileManagerLocalContextProvider } from "./FileManagerLocalContext";
import { FileTree } from "./FileTree";
import { FileTreeContainer } from "./FileTreeContainer";

const DEFAULT_CWD = "/project-dir:/";

export function FileManager() {
  const { projectUuid } = usePipelineDataContext();
  const {
    isDragging,
    selectedFiles,
    setSelectedFiles,
  } = useFileManagerContext();

  const { roots } = useFetchFileRoots();
  const expand = useFileApi((api) => api.expand);

  const containerRef = React.useRef<HTMLDivElement | null>(null);

  // only show the progress if it takes longer than 125 ms
  const [_inProgress, setInProgress] = React.useState(false);
  const inProgress = useDebounce(_inProgress, 125);

  const [expanded, setExpanded] = React.useState<string[]>([DEFAULT_CWD]);
  const [progress, setProgress] = React.useState(0);
  const [contextMenuOrigin, setContextMenuOrigin] = React.useState<Point2D>();

  const { root, path: cwd } = unpackPath(
    nearestDirectory(selectedFiles[0] || DEFAULT_CWD)
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
    (_: React.SyntheticEvent, paths: string[]) => {
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
        .filter(({ root, path }) => roots[root]?.[path])
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

  const addExpand = React.useCallback((root: FileRoot, newPath: string) => {
    const combinedPath = combinePath({ root, path: newPath });
    const directory = isDirectory(newPath) ? newPath : dirname(combinedPath);

    setExpanded((current) =>
      current.includes(directory) ? current : [...current, directory]
    );
  }, []);

  const handleUpload = React.useCallback(
    (files: FileList | File[]) =>
      uploader
        .uploadFiles(cwd, files)
        .then(() => expand(root, cwd).then(() => addExpand(root, cwd))),
    [uploader, root, cwd, addExpand, expand]
  );

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
          setContextMenuOrigin={setContextMenuOrigin}
        >
          <CreatePipelineButton />
          <ActionBar
            setExpanded={setExpanded}
            uploadFiles={handleUpload}
            cwd={cwd}
            root={root}
            onCreated={addExpand}
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
                <FileManagerContextMenu
                  origin={contextMenuOrigin}
                  onCollapse={() => setExpanded([])}
                />
              </>
            )}
          </FileTreeContainer>
        </FileManagerLocalContextProvider>
      </FileManagerContainer>
    </>
  );
}
