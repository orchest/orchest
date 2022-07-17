import { MouseTracker } from "@/types";
import React from "react";

export type PipelineRefsContextType = {
  mouseTracker: React.MutableRefObject<MouseTracker>;
  pipelineCanvasRef: React.MutableRefObject<HTMLDivElement | null>;
  pipelineViewportRef: React.MutableRefObject<HTMLDivElement | null>;
  keysDown: Set<number | string>;
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

  const keysDown = React.useMemo<Set<number>>(() => new Set(), []);

  return (
    <PipelineRefsContext.Provider
      value={{ mouseTracker, pipelineCanvasRef, pipelineViewportRef, keysDown }}
    >
      {children}
    </PipelineRefsContext.Provider>
  );
};
