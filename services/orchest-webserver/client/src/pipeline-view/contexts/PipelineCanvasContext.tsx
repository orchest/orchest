import { useCustomRoute } from "@/hooks/useCustomRoute";
import { Position } from "@/types";
import React from "react";
import { PipelineCanvasState } from "../hooks/usePipelineCanvasState";
import { useKeyboardEventsOnViewport } from "../pipeline-viewport/useKeyboardEventsOnViewport";

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
  zoom: (mousePosition: Position, scaleDiff: number) => void;
  zoomIn: (value?: number) => void;
  zoomOut: (value?: number) => void;
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

  // const updateQueryArgs = useUpdateQueryArgs();

  // const [fullscreenTab, originalSetFullscreenTab] = React.useState(
  const [fullscreenTab, setFullscreenTab] = React.useState(
    tab as PipelineFullscreenTabType
  );

  // const {
  //   projectUuid,
  //   pipelineUuid,
  //   jobUuid,
  //   runUuid,
  //   isJobRun,
  // } = usePipelineDataContext();

  // const setFullscreenTab = React.useCallback(
  //   (value: React.SetStateAction<PipelineFullscreenTabType>) => {
  //     originalSetFullscreenTab((current) => {
  //       const newValue = value instanceof Function ? value(current) : value;
  //       const extraArgs = isJobRun ? { jobUuid, runUuid } : null;
  //       updateQueryArgs({
  //         projectUuid,
  //         pipelineUuid,
  //         tab: newValue,
  //         ...extraArgs,
  //       });
  //       return newValue;
  //     });
  //   },
  //   [isJobRun, jobUuid, pipelineUuid, projectUuid, runUuid, updateQueryArgs]
  // );

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
        fullscreenTab,
        setFullscreenTab,
      }}
    >
      {children}
    </PipelineCanvasContext.Provider>
  );
};
