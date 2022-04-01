import React from "react";
import type { FileTrees } from "./common";

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
  dragFile: DragFile;
  setDragFile: React.Dispatch<React.SetStateAction<DragFile | undefined>>;
  hoveredPath: string;
  setHoveredPath: React.Dispatch<React.SetStateAction<string>>;
  isDragging: boolean;
  setIsDragging: React.Dispatch<React.SetStateAction<boolean>>;
  resetMove: () => void;
  fileTrees: FileTrees;
  setFileTrees: React.Dispatch<React.SetStateAction<FileTrees>>;
  filePathChanges: FilePathChange[] | undefined;
  setFilePathChanges: React.Dispatch<
    React.SetStateAction<FilePathChange[] | undefined>
  >;
};

export const FileManagerContext = React.createContext<FileManagerContextType>(
  null
);

export const useFileManagerContext = () => React.useContext(FileManagerContext);

export const FileManagerContextProvider: React.FC = ({ children }) => {
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
  }>(undefined);
  const [hoveredPath, setHoveredPath] = React.useState<string | undefined>(
    undefined
  );
  const [isDragging, setIsDragging] = React.useState(false);

  const [fileTrees, setFileTrees] = React.useState<FileTrees>({});

  const [filePathChanges, setFilePathChanges] = React.useState<
    FilePathChange[]
  >(undefined);

  const resetMove = React.useCallback(() => {
    // Needs to be delayed to prevent tree toggle
    // while dragging.
    window.setTimeout(() => {
      setIsDragging(false);
      setHoveredPath(undefined);
      setDragFile(undefined);
    }, 1);
  }, [setIsDragging, setDragFile, setHoveredPath]);

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
        fileTrees,
        setFileTrees,
        filePathChanges,
        setFilePathChanges,
      }}
    >
      {children}
    </FileManagerContext.Provider>
  );
};
