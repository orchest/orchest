import { Position } from "@/types";
import React from "react";
import {
  INITIAL_PIPELINE_POSITION,
  PipelineCanvasState,
  usePipelineCanvasState,
} from "../hooks/usePipelineCanvasState";
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
};

export const PipelineCanvasContext = React.createContext<
  PipelineCanvasContextType
>({} as PipelineCanvasContextType);

export const usePipelineCanvasContext = () =>
  React.useContext(PipelineCanvasContext);

export const PipelineCanvasContextProvider: React.FC = ({ children }) => {
  const [
    pipelineCanvasState,
    setPipelineCanvasState,
  ] = usePipelineCanvasState();

  const resetPipelineCanvas = React.useCallback(() => {
    setPipelineCanvasState({
      pipelineOffset: INITIAL_PIPELINE_POSITION,
      pipelineStepsHolderOffsetLeft: 0,
      pipelineStepsHolderOffsetTop: 0,
    });
  }, [setPipelineCanvasState]);

  const {
    setPipelineHolderOrigin,
    centerView,
    centerPipelineOrigin,
    zoom,
  } = useKeyboardEventsOnViewport(setPipelineCanvasState, resetPipelineCanvas);

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
      }}
    >
      {children}
    </PipelineCanvasContext.Provider>
  );
};
