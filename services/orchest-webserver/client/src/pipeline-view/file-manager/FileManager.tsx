import { useFileApi } from "@/api/files/useFileApi";
import { useCurrentQuery } from "@/hooks/useCustomRoute";
import { useDebounce } from "@/hooks/useDebounce";
import { useFetchFileRoots } from "@/hooks/useFetchFileRoots";
import { useUploader } from "@/hooks/useUploader";
import {
  combinePath,
  FileRoot,
  fileRoots,
  UnpackedPath,
  unpackPath,
} from "@/utils/file";
import {
  dirname,
  hasExtension,
  isDirectory,
  nearestDirectory,
} from "@/utils/path";
import LinearProgress from "@mui/material/LinearProgress";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { FileContextMenu } from "../components/FileContextMenu";
import { useFileManagerLocalContext } from "../contexts/FileManagerLocalContext";
import { usePipelineDataContext } from "../contexts/PipelineDataContext";
import { useExpandedFiles } from "../hooks/useExpandedFiles";
import { useFileManagerState } from "../hooks/useFileManagerState";
import { useOpenFile } from "../hooks/useOpenFile";
import { ActionBar } from "./ActionBar";
import { CreatePipelineButton } from "./CreatePipelineButton";
import { FileManagerContainer } from "./FileManagerContainer";
import { useFileManagerContext } from "./FileManagerContext";
import { FileTree } from "./FileTree";
import { FileTreeContainer } from "./FileTreeContainer";

const DEFAULT_CWD = "/project-dir:/";

export function FileManager() {
  const { projectUuid } = usePipelineDataContext();

  const { isDragging } = useFileManagerContext();
  const selectedFiles = useFileManagerState((state) => state.selected);
  const setSelectedFiles = useFileManagerState((state) => state.setSelected);
  const {
    contextMenuPath,
    contextMenuOrigin,
    setContextMenuOrigin,
    handleDelete,
    handleDownload,
    handleRename,
  } = useFileManagerLocalContext();

  const { roots } = useFetchFileRoots();
  const expand = useFileApi((api) => api.expand);
  const { openPipeline, previewFile } = useOpenFile();

  const containerRef = React.useRef<HTMLDivElement | null>(null);

  // only show the progress if it takes longer than 125 ms
  const [_inProgress, setInProgress] = React.useState(false);
  const inProgress = useDebounce(_inProgress, 125);

  const expanded = useExpandedFiles();
  const setExpanded = useFileManagerState((state) => state.setExpanded);
  const [progress, setProgress] = React.useState(0);
  const { fileRoot, filePath } = useCurrentQuery();
  const currentPath =
    fileRoot && filePath
      ? combinePath({ root: fileRoot as FileRoot, path: filePath })
      : undefined;

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
    [expand, expanded, isDragging, setExpanded]
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
  }, [roots, setExpanded, setSelectedFiles]);

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
    [expanded, selectedFiles, setExpanded, setSelectedFiles]
  );

  const addExpand = React.useCallback(
    (root: FileRoot, newPath: string) => {
      const combinedPath = combinePath({ root, path: newPath });
      const directory = isDirectory(newPath) ? newPath : dirname(combinedPath);

      setExpanded((current) =>
        current.includes(directory) ? current : [...current, directory]
      );
    },
    [setExpanded]
  );

  const handleUpload = React.useCallback(
    (files: FileList | File[]) =>
      uploader
        .uploadFiles(cwd, files)
        .then(() => expand(root, cwd).then(() => addExpand(root, cwd))),
    [uploader, root, cwd, addExpand, expand]
  );

  const handleViewFile = React.useCallback(
    (unpacked: UnpackedPath) => {
      if (isDirectory(unpacked.path)) return;

      if (hasExtension(unpacked.path, ".orchest")) {
        openPipeline(unpacked.path);
      } else {
        previewFile(unpacked);
      }
    },
    [openPipeline, previewFile]
  );

  const handlePreview = React.useCallback(
    (selected: string) => {
      if (currentPath === selected) return;
      handleViewFile(unpackPath(selected));
    },
    [currentPath, handleViewFile]
  );

  return (
    <FileManagerContainer ref={containerRef} uploadFiles={handleUpload}>
      {inProgress && (
        <LinearProgress
          sx={{ position: "absolute", width: "100%" }}
          value={progress}
          variant="determinate"
        />
      )}
      <CreatePipelineButton />
      <ActionBar
        uploadFiles={handleUpload}
        cwd={cwd}
        root={root}
        onCreated={addExpand}
      />
      <FileTreeContainer>
        {allTreesHaveLoaded && (
          <>
            <FileTree
              onSelect={handlePreview}
              treeRoots={fileRoots}
              expanded={expanded}
              onMoved={onMoved}
              handleToggle={handleToggle}
            />
            {contextMenuPath && (
              <FileContextMenu
                {...unpackPath(contextMenuPath)}
                open={Boolean(contextMenuOrigin)}
                anchorReference="anchorPosition"
                anchorPosition={{
                  left: contextMenuOrigin?.[0] ?? 0,
                  top: contextMenuOrigin?.[1] ?? 0,
                }}
                onClose={() => setContextMenuOrigin(undefined)}
                onClickDelete={handleDelete}
                onClickDownload={handleDownload}
                onClickRename={handleRename}
                onClickCollapse={() => setExpanded([])}
              />
            )}
          </>
        )}
      </FileTreeContainer>
    </FileManagerContainer>
  );
}
