import { MouseTracker, NewConnection } from "@/types";
import React from "react";

export type PipelineRefsContextType = {
  mouseTracker: React.MutableRefObject<MouseTracker>;
  pipelineCanvasRef: React.MutableRefObject<HTMLDivElement | null>;
  pipelineViewportRef: React.MutableRefObject<HTMLDivElement | null>;
  keysDown: Set<number | string>;
  stepRefs: React.MutableRefObject<Record<string, HTMLElement | null>>;
  draggedStepPositions: React.MutableRefObject<
    Record<string, [number, number]>
  >;
  newConnection: React.MutableRefObject<NewConnection | undefined>;
  zIndexMax: React.MutableRefObject<number>;
};

export const PipelineRefsContext = React.createContext<PipelineRefsContextType>(
  {} as PipelineRefsContextType
);

export const usePipelineRefs = () => React.useContext(PipelineRefsContext);

export const PipelineRefsProvider: React.FC = ({ children }) => {
  const mouseTracker = React.useRef<MouseTracker>({
    client: { x: 0, y: 0 },
    prev: { x: 0, y: 0 },
    delta: { x: 0, y: 0 },
    unscaledPrev: { x: 0, y: 0 },
    unscaledDelta: { x: 0, y: 0 },
  });

  const pipelineCanvasRef = React.useRef<HTMLDivElement | null>(null);
  const pipelineViewportRef = React.useRef<HTMLDivElement | null>(null);
  const stepRefs = React.useRef<Record<string, HTMLDivElement>>({});
  const newConnection = React.useRef<NewConnection>();
  // calculate z-index max when initializing steps and connections.
  // zIndexMax is the initial total count of all steps and connections
  const zIndexMax = React.useRef<number>(0);

  // this is used for temporarily saving dragged steps' positions
  const draggedStepPositions = React.useRef<Record<string, [number, number]>>(
    {}
  );

  const keysDown = React.useMemo<Set<number>>(() => new Set(), []);

  return (
    <PipelineRefsContext.Provider
      value={{
        mouseTracker,
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
