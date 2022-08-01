import { ElementSize } from "@/components/ResizableContainer";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { isNumber } from "@/utils/webserver-utils";
import React from "react";

const DEFAULT_MAIN_SIDE_PANEL_WIDTH = 300;
export const MIN_MAIN_SIDE_PANEL_WIDTH = 252;
const DEFAULT_STEP_DETAILS_PANEL_WIDTH = 450;
const MIN_STEP_DETAILS_PANEL_WIDTH = 420;

const getRangedValue = (
  value: number,
  min: number = value,
  max: number = value
) => {
  return Math.min(Math.max(value, min), max);
};

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
  const [width, setWidth, saveWidthToLocalstorage] = useLocalStorage(
    key,
    defaultValue
  );

  const setRangedWidth = React.useCallback(
    (value: React.SetStateAction<number>) => {
      setWidth((prevPanelWidth) => {
        const newValue =
          value instanceof Function ? value(prevPanelWidth) : value;
        return getRangedValue(newValue, min, max);
      });
    },
    [min, max, setWidth]
  );

  const saveWidth = React.useCallback(
    ({ width }: Pick<ElementSize, "width">) => {
      if (isNumber(width)) {
        saveWidthToLocalstorage(Number(width));
      }
    },
    [saveWidthToLocalstorage]
  );

  return [width, setRangedWidth, saveWidth] as const;
};

export type PipelineCanvasDimensionsContextType = {
  mainSidePanelWidth: number;
  setMainSidePanelWidth: React.Dispatch<React.SetStateAction<number>>;
  saveMainSidePanelWidth: ({ width }: Pick<ElementSize, "width">) => void;
  stepDetailsPanelWidth: number;
  setStepDetailsPanelWidth: React.Dispatch<React.SetStateAction<number>>;
  saveStepDetailsPanelWidth: ({ width }: Pick<ElementSize, "width">) => void;
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
