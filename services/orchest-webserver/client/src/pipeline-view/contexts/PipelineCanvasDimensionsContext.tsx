import { ElementSize } from "@/components/ResizableContainer";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { isNumber } from "@/utils/webserver-utils";
import React from "react";

const DEFAULT_MAIN_SIDE_PANEL_WIDTH = 300;
const MIN_MAIN_SIDE_PANEL_WIDTH = 252;
const DEFAULT_STEP_DETAILS_PANEL_WIDTH = 450;
const MIN_STEP_DETAILS_PANEL_WIDTH = 420;

const getRangedValue = (
  value: number,
  min: number | undefined,
  max: number | undefined
) => {
  const validMin = min ?? value;
  const validMax = max ?? value;
  return Math.min(validMax, Math.max(value, validMin));
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
  const [storedWidth, , saveWidthToLocalstorage] = useLocalStorage(
    key,
    defaultValue
  );

  const [width, setWidth] = React.useState(storedWidth);
  const setRangedWidth = React.useCallback(
    (value: React.SetStateAction<number>) => {
      setWidth((prevPanelWidth) => {
        const newValue =
          value instanceof Function ? value(prevPanelWidth) : value;
        return getRangedValue(newValue, min, max);
      });
    },
    [min, max]
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
  readonly minMainSidePanelWidth: number;
  saveMainSidePanelWidth: ({ width }: Pick<ElementSize, "width">) => void;
  stepDetailsPanelWidth: number;
  setStepDetailsPanelWidth: React.Dispatch<React.SetStateAction<number>>;
  readonly minStepDetailsPanelWidth: number;
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
  });

  const [
    stepDetailsPanelWidth,
    setStepDetailsPanelWidth,
    saveStepDetailsPanelWidth,
  ] = useCanvasContainerWidth({
    key: "pipelineDetails.panelWidth",
    defaultValue: DEFAULT_STEP_DETAILS_PANEL_WIDTH,
    min: MIN_STEP_DETAILS_PANEL_WIDTH,
  });

  return (
    <PipelineCanvasDimensionsContext.Provider
      value={{
        mainSidePanelWidth,
        setMainSidePanelWidth,
        minMainSidePanelWidth: MIN_MAIN_SIDE_PANEL_WIDTH,
        saveMainSidePanelWidth,
        stepDetailsPanelWidth,
        setStepDetailsPanelWidth,
        minStepDetailsPanelWidth: MIN_STEP_DETAILS_PANEL_WIDTH,
        saveStepDetailsPanelWidth,
      }}
    >
      {children}
    </PipelineCanvasDimensionsContext.Provider>
  );
};
