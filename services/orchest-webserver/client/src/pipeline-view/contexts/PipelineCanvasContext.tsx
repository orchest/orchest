import { useCustomRoute } from "@/hooks/useCustomRoute";
import { Point2D } from "@/types";
import React from "react";
import { PipelineCanvasState } from "../hooks/usePipelineCanvasState";
import { useKeyboardEventsOnViewport } from "../pipeline-viewport/hooks/useKeyboardEventsOnViewport";

export type PipelineSettingsTab =
  | "configuration"
  | "environment-variables"
  | "services";

export type PipelineFullscreenTabType =
  | "logs"
  | PipelineSettingsTab
  | undefined;

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
  zoomBy: (origin: Point2D, delta: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  fullscreenTab: PipelineFullscreenTabType;
  setFullscreenTab: React.Dispatch<
    React.SetStateAction<PipelineFullscreenTabType>
  >;
};

export const PipelineCanvasContext = React.createContext<
  PipelineCanvasContextType
>({} as PipelineCanvasContextType);

export const usePipelineCanvasContext = () =>
  React.useContext(PipelineCanvasContext);

export const PipelineCanvasContextProvider: React.FC = ({ children }) => {
  const { tab } = useCustomRoute();

  const [fullscreenTab, setFullscreenTab] = React.useState(
    tab as PipelineFullscreenTabType
  );

  const {
    pipelineCanvasState,
    setPipelineCanvasState,
    resetPipelineCanvas,
    centerView,
    centerPipelineOrigin,
    setPipelineHolderOrigin,
    zoomBy,
    zoomIn,
    zoomOut,
    resetZoom,
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
        zoomBy,
        zoomIn,
        zoomOut,
        fullscreenTab,
        setFullscreenTab,
        resetZoom,
      }}
    >
      {children}
    </PipelineCanvasContext.Provider>
  );
};
