import { useCustomRoute } from "@/hooks/useCustomRoute";
import { Point2D } from "@/utils/geometry";
import React from "react";
import { PipelineCanvasState } from "../hooks/usePipelineCanvasState";
import { useViewportKeyboardEvents } from "../pipeline-viewport/hooks/useViewportKeyboardEvents";

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
  setPipelineCanvasOrigin: (newOrigin: Point2D) => void;
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
    setPipelineCanvasOrigin,
    zoomBy,
    zoomIn,
    zoomOut,
    resetZoom,
  } = useViewportKeyboardEvents();

  return (
    <PipelineCanvasContext.Provider
      value={{
        pipelineCanvasState,
        setPipelineCanvasState,
        resetPipelineCanvas,
        setPipelineCanvasOrigin,
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
