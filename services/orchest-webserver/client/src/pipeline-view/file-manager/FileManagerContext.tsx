import { useCancelableFetch } from "@/hooks/useCancelablePromise";
import { prune } from "@/utils/record";
import { queryArgs } from "@/utils/text";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { FileManagementRoot, treeRoots } from "../common";
import type { FileTrees, TreeNode } from "./common";
import { FILE_MANAGEMENT_ENDPOINT } from "./common";

type DragFile = {
  labelText: string;
  path: string;
};

export type FilePathChange = {
  oldRoot: string;
  oldPath: string;
  newRoot: string;
  newPath: string;
};

export type FileManagerContextType = {
  selectedFiles: string[];
  setSelectedFiles: React.Dispatch<React.SetStateAction<string[]>>;
  dragFile: DragFile | undefined;
  setDragFile: React.Dispatch<React.SetStateAction<DragFile | undefined>>;
  hoveredPath: string | undefined;
  setHoveredPath: React.Dispatch<React.SetStateAction<string | undefined>>;
  isDragging: boolean;
  setIsDragging: React.Dispatch<React.SetStateAction<boolean>>;
  resetMove: () => void;
  /**
   * Fetches (or reloads) all file trees to a certain depth.
   * Anything deeper than the provided depth will be pruned in the updated file trees.
   * @param depth How many subdirectories deep to search.
   */
  fetchFileTrees: (depth?: number) => Promise<void>;
  /**
   * Fetches a portion of the file tree from the back-end and updates the file trees.
   * @param root The root to search: either `/project-dir` or `/data`.
   * @param path The path to browser, or `undefined` if you want to search from the root.
   * @param depth How many subdirectories deep to search. Defaults to 1 when a path is specified otherwise 2.
   */
  browse: (
    root: FileManagementRoot,
    path?: string,
    depth?: number
  ) => Promise<TreeNode>;
  fileTrees: FileTrees;
  setFileTrees: React.Dispatch<React.SetStateAction<FileTrees>>;
  fileTreeDepth: React.MutableRefObject<number>;
};

export const FileManagerContext = React.createContext<FileManagerContextType>(
  {} as FileManagerContextType
);

export const useFileManagerContext = () => React.useContext(FileManagerContext);

export const FileManagerContextProvider: React.FC<{
  projectUuid: string | undefined;
  pipelineUuid?: string | undefined;
  jobUuid?: string | undefined;
  runUuid?: string | undefined;
}> = ({ children, projectUuid, pipelineUuid, jobUuid, runUuid }) => {
  const fileTreeDepth = React.useRef<number>(2);
  const [selectedFiles, _setSelectedFiles] = React.useState<string[]>([]);

  const setSelectedFiles = React.useCallback(
    (stateAction: React.SetStateAction<string[]>) => {
      _setSelectedFiles((current) => {
        const updated =
          stateAction instanceof Function ? stateAction(current) : stateAction;
        return [...new Set(updated)]; // ensure no duplication
      });
    },
    []
  );

  const [dragFile, setDragFile] = React.useState<{
    labelText: string;
    path: string;
  }>();
  const [hoveredPath, setHoveredPath] = React.useState<string>();
  const [isDragging, setIsDragging] = React.useState(false);

  const [fileTrees, setFileTrees] = React.useState<FileTrees>({});

  const resetMove = React.useCallback(() => {
    // Needs to be delayed to prevent tree toggle
    // while dragging.
    window.setTimeout(() => {
      setIsDragging(false);
      setHoveredPath(undefined);
      setDragFile(undefined);
    }, 1);
  }, [setIsDragging, setDragFile, setHoveredPath]);

  const { cancelableFetch } = useCancelableFetch();

  const browse = React.useCallback(
    (
      root: FileManagementRoot,
      path?: string | undefined,
      depth = hasValue(path) ? 1 : 2
    ) =>
      cancelableFetch<TreeNode>(
        `${FILE_MANAGEMENT_ENDPOINT}/browse?` +
          queryArgs(
            prune({
              projectUuid,
              pipelineUuid,
              jobUuid,
              runUuid,
              root,
              path: path || undefined,
              depth,
            })
          )
      ),
    [cancelableFetch, projectUuid, pipelineUuid, jobUuid, runUuid]
  );

  const fetchFileTrees = React.useCallback(
    async (depth?: number) => {
      const newRoots = await Promise.all(
        treeRoots.map((root) =>
          browse(root, undefined, depth)
            .then((node) => [root, node] as const)
            .catch(() => [root, undefined] as const)
        )
      );

      setFileTrees(prune(Object.fromEntries(newRoots)));
    },
    [browse]
  );

  return (
    <FileManagerContext.Provider
      value={{
        browse,
        selectedFiles,
        setSelectedFiles,
        dragFile,
        setDragFile,
        hoveredPath,
        setHoveredPath,
        isDragging,
        setIsDragging,
        resetMove,
        fetchFileTrees,
        fileTrees,
        setFileTrees,
        fileTreeDepth,
      }}
    >
      {children}
    </FileManagerContext.Provider>
  );
};
