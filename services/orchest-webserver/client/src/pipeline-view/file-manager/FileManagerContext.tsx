import { useCustomRoute } from "@/hooks/useCustomRoute";
import { FileTree } from "@/types";
import { fetcher } from "@orchest/lib-utils";
import React from "react";
import { treeRoots } from "../common";
import type { FileTrees } from "./common";
import { FILE_MANAGEMENT_ENDPOINT, queryArgs } from "./common";

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
  fetchFileTrees: (depth?: number) => Promise<void>;
  fileTrees: FileTrees;
  setFileTrees: React.Dispatch<React.SetStateAction<FileTrees>>;
  fileTreeDepth: React.MutableRefObject<number>;
};

export const FileManagerContext = React.createContext<FileManagerContextType>(
  {} as FileManagerContextType
);

export const useFileManagerContext = () => React.useContext(FileManagerContext);

export const FileManagerContextProvider: React.FC = ({ children }) => {
  const { projectUuid } = useCustomRoute();

  const fileTreeDepth = React.useRef<number>(3);
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

  const fetchFileTrees = React.useCallback(
    async (depth?: number) => {
      if (!projectUuid) return;
      if (depth) {
        fileTreeDepth.current = Math.max(fileTreeDepth.current, depth);
      }

      const newFiles = await Promise.all(
        treeRoots.map(async (root) => {
          const file = await fetcher<FileTree>(
            `${FILE_MANAGEMENT_ENDPOINT}/browse?${queryArgs({
              project_uuid: projectUuid,
              root,
              depth: fileTreeDepth.current,
            })}`
          );
          return { key: root, file };
        })
      );

      setFileTrees(
        newFiles.reduce((obj, curr) => {
          return { ...obj, [curr.key]: curr.file };
        }, {})
      );
    },
    [projectUuid]
  );

  return (
    <FileManagerContext.Provider
      value={{
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
