import React from "react";

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
  // TODO: Move the rest of this to `useSelectedFiles`
  dragFile: DragFile | undefined;
  setDragFile: React.Dispatch<React.SetStateAction<DragFile | undefined>>;
  hoveredPath: string | undefined;
  setHoveredPath: React.Dispatch<React.SetStateAction<string | undefined>>;
  isDragging: boolean;
  setIsDragging: React.Dispatch<React.SetStateAction<boolean>>;
  resetMove: () => void;
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
}> = ({ children }) => {
  const [dragFile, setDragFile] = React.useState<{
    labelText: string;
    path: string;
  }>();
  const [hoveredPath, setHoveredPath] = React.useState<string>();
  const [isDragging, setIsDragging] = React.useState(false);

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
        dragFile,
        setDragFile,
        hoveredPath,
        setHoveredPath,
        isDragging,
        setIsDragging,
        resetMove,
      }}
    >
      {children}
    </FileManagerContext.Provider>
  );
};
