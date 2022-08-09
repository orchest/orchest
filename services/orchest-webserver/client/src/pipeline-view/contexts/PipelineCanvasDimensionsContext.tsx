import { useLocalStorage } from "@/hooks/useLocalStorage";
import { clamp } from "@/utils/math";
import React from "react";

export const DEFAULT_MAIN_SIDE_PANEL_WIDTH = 300;
export const MIN_MAIN_SIDE_PANEL_WIDTH = 252;
export const DEFAULT_STEP_DETAILS_PANEL_WIDTH = 450;
export const MIN_STEP_DETAILS_PANEL_WIDTH = 420;

type UseCanvasContainerWidthParams = {
  key: string;
  defaultValue: number;
  min?: number;
  max?: number;
};

const useCanvasContainerWidth = ({
  key,
  defaultValue,
  min,
  max,
}: UseCanvasContainerWidthParams) => {
  const [width, setWidth, saveWidthToLocalStorage] = useLocalStorage(
    key,
    defaultValue
  );

  const setClampedWidth = React.useCallback(
    (value: React.SetStateAction<number>) => {
      setWidth((prevPanelWidth) => {
        const newValue =
          value instanceof Function ? value(prevPanelWidth) : value;
        return clamp(newValue, min, max);
      });
    },
    [min, max, setWidth]
  );

  const saveWidth = React.useCallback(
    (width: number) => saveWidthToLocalStorage(width),

    [saveWidthToLocalStorage]
  );

  return [width, setClampedWidth, saveWidth] as const;
};

export type PipelineCanvasDimensionsContextType = {
  mainSidePanelWidth: number;
  setMainSidePanelWidth: React.Dispatch<React.SetStateAction<number>>;
  saveMainSidePanelWidth: (width: number) => void;
  stepDetailsPanelWidth: number;
  setStepDetailsPanelWidth: React.Dispatch<React.SetStateAction<number>>;
  saveStepDetailsPanelWidth: (width: number) => void;
};

export const PipelineCanvasDimensionsContext = React.createContext<
  PipelineCanvasDimensionsContextType
>({} as PipelineCanvasDimensionsContextType);

export const usePipelineCanvasDimensionsContext = () =>
  React.useContext(PipelineCanvasDimensionsContext);

export const PipelineCanvasDimensionsContextProvider: React.FC = ({
  children,
}) => {
  const [
    mainSidePanelWidth,
    setMainSidePanelWidth,
    saveMainSidePanelWidth,
  ] = useCanvasContainerWidth({
    key: "pipelineEditor.panelWidth",
    defaultValue: DEFAULT_MAIN_SIDE_PANEL_WIDTH,
    min: MIN_MAIN_SIDE_PANEL_WIDTH,
    max: window.innerWidth / 2,
  });

  const [
    stepDetailsPanelWidth,
    setStepDetailsPanelWidth,
    saveStepDetailsPanelWidth,
  ] = useCanvasContainerWidth({
    key: "pipelineDetails.panelWidth",
    defaultValue: DEFAULT_STEP_DETAILS_PANEL_WIDTH,
    min: MIN_STEP_DETAILS_PANEL_WIDTH,
    max: window.innerWidth / 2,
  });

  return (
    <PipelineCanvasDimensionsContext.Provider
      value={{
        mainSidePanelWidth,
        setMainSidePanelWidth,
        saveMainSidePanelWidth,
        stepDetailsPanelWidth,
        setStepDetailsPanelWidth,
        saveStepDetailsPanelWidth,
      }}
    >
      {children}
    </PipelineCanvasDimensionsContext.Provider>
  );
};
