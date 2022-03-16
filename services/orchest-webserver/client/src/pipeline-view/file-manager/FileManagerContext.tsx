import { Position } from "@/types";
import React from "react";

type DragFile = {
  labelText: string;
  path: string;
};

export type FileManagerContextType = {
  selectedFiles: string[];
  setSelectedFiles: React.Dispatch<React.SetStateAction<string[]>>;
  dragFile: DragFile;
  setDragFile: React.Dispatch<React.SetStateAction<DragFile | undefined>>;
  dragOffset: Position;
  setDragOffset: React.Dispatch<React.SetStateAction<Position>>;
  hoveredPath: string;
  setHoveredPath: React.Dispatch<React.SetStateAction<string>>;
  isDragging: boolean;
  setIsDragging: React.Dispatch<React.SetStateAction<boolean>>;
  resetMove: () => void;
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
  const [dragOffset, setDragOffset] = React.useState<Position>({ x: 0, y: 0 });
  const [hoveredPath, setHoveredPath] = React.useState<string | undefined>(
    undefined
  );
  const [isDragging, setIsDragging] = React.useState(false);

  const resetMove = React.useCallback(() => {
    // Needs to be delayed to prevent tree toggle
    // while dragging.
    window.setTimeout(() => {
      setDragOffset({ x: 0, y: 0 });
      setIsDragging(false);
      setHoveredPath(undefined);
      setDragFile(undefined);
    }, 1);
  }, [setDragOffset, setIsDragging, setDragFile, setHoveredPath]);

  return (
    <FileManagerContext.Provider
      value={{
        selectedFiles,
        setSelectedFiles,
        dragFile,
        setDragFile,
        dragOffset,
        setDragOffset,
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
