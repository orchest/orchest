import { Position } from "@/types";
import React from "react";
import { PipelineCanvasState } from "../hooks/usePipelineCanvasState";
import { useKeyboardEventsOnViewport } from "../pipeline-viewport/useKeyboardEventsOnViewport";

export type PipelineCanvasContextType = {
  pipelineCanvasState: PipelineCanvasState;
  setPipelineCanvasState: React.Dispatch<
    | Partial<PipelineCanvasState>
    | ((current: PipelineCanvasState) => Partial<PipelineCanvasState>)
  >;
  resetPipelineCanvas: () => void;
  setPipelineHolderOrigin: (newOrigin: [number, number]) => void;
  centerView: () => void;
  centerPipelineOrigin: () => void;
  zoom: (mousePosition: Position, scaleDiff: number) => void;
  zoomIn: (value?: number) => void;
  zoomOut: (value?: number) => void;
};

export const PipelineCanvasContext = React.createContext<
  PipelineCanvasContextType
>({} as PipelineCanvasContextType);

export const usePipelineCanvasContext = () =>
  React.useContext(PipelineCanvasContext);

export const PipelineCanvasContextProvider: React.FC = ({ children }) => {
  const {
    pipelineCanvasState,
    setPipelineCanvasState,
    resetPipelineCanvas,
    centerView,
    centerPipelineOrigin,
    setPipelineHolderOrigin,
    zoom,
    zoomIn,
    zoomOut,
  } = useKeyboardEventsOnViewport();

  return (
    <PipelineCanvasContext.Provider
      value={{
        pipelineCanvasState,
        setPipelineCanvasState,
        resetPipelineCanvas,
        setPipelineHolderOrigin,
        centerView,
        centerPipelineOrigin,
        zoom,
        zoomIn,
        zoomOut,
      }}
    >
      {children}
    </PipelineCanvasContext.Provider>
  );
};
