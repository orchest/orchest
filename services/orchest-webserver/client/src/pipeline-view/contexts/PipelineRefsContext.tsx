import { NewConnection } from "@/types";
import { Point2D } from "@/utils/geometry";
import React from "react";

export type PipelineRefsContextType = {
  pipelineCanvasRef: React.MutableRefObject<HTMLDivElement | null>;
  pipelineViewportRef: React.MutableRefObject<HTMLDivElement | null>;
  keysDown: Set<number | string>;
  stepRefs: React.MutableRefObject<Record<string, HTMLElement | null>>;
  draggedStepPositions: React.MutableRefObject<Record<string, Point2D>>;
  newConnection: React.MutableRefObject<NewConnection | undefined>;
  zIndexMax: React.MutableRefObject<number>;
};

export const PipelineRefsContext = React.createContext<PipelineRefsContextType>(
  {} as PipelineRefsContextType
);

export const usePipelineRefs = () => React.useContext(PipelineRefsContext);

export const PipelineRefsProvider: React.FC = ({ children }) => {
  const pipelineCanvasRef = React.useRef<HTMLDivElement | null>(null);
  const pipelineViewportRef = React.useRef<HTMLDivElement | null>(null);
  const stepRefs = React.useRef<Record<string, HTMLDivElement>>({});
  const newConnection = React.useRef<NewConnection>();

  // calculate z-index max when initializing steps and connections.
  // zIndexMax is the initial total count of all steps and connections
  const zIndexMax = React.useRef<number>(0);

  // this is used for temporarily saving dragged steps' positions
  const draggedStepPositions = React.useRef<Record<string, Point2D>>({});

  const keysDown = React.useMemo(() => new Set<number>(), []);

  return (
    <PipelineRefsContext.Provider
      value={{
        pipelineCanvasRef,
        pipelineViewportRef,
        keysDown,
        stepRefs,
        newConnection,
        draggedStepPositions,
        zIndexMax,
      }}
    >
      {children}
    </PipelineRefsContext.Provider>
  );
};
