import React from "react";
import {
  INITIAL_PIPELINE_POSITION,
  PipelineCanvasState,
  usePipelineCanvasState,
} from "../hooks/usePipelineCanvasState";

export type PipelineCanvasContextType = {
  pipelineCanvasState: PipelineCanvasState;
  setPipelineCanvasState: React.Dispatch<
    | Partial<PipelineCanvasState>
    | ((current: PipelineCanvasState) => Partial<PipelineCanvasState>)
  >;
  resetPipelineCanvas: () => void;
};

export const PipelineCanvasContext = React.createContext<
  PipelineCanvasContextType
>(null);

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

  return (
    <PipelineCanvasContext.Provider
      value={{
        pipelineCanvasState,
        setPipelineCanvasState,
        resetPipelineCanvas,
      }}
    >
      {children}
    </PipelineCanvasContext.Provider>
  );
};
