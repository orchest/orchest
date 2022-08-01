import { ElementSize } from "@/components/ResizableContainer";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { isNumber } from "@/utils/webserver-utils";
import React from "react";

const DEFAULT_MAIN_SIDE_PANEL_WIDTH = 300;
const MIN_MAIN_SIDE_PANEL_WIDTH = 252;
const DEFAULT_STEP_DETAILS_PANEL_WIDTH = 450;
const MIN_STEP_DETAILS_PANEL_WIDTH = 420;

const useCanvasContainerWidth = (key: string, defaultValue: number) => {
  const [width, , setWidth] = useLocalStorage(key, defaultValue);

  const saveWidth = React.useCallback(
    ({ width }: Pick<ElementSize, "width">) => {
      if (isNumber(width)) {
        setWidth(Number(width));
      }
    },
    [setWidth]
  );

  return [width, saveWidth] as const;
};

export type PipelineCanvasDimensionsContextType = {
  mainSidePanelWidth: number;
  readonly minMainSidePanelWidth: number;
  saveMainSidePanelWidth: ({ width }: Pick<ElementSize, "width">) => void;
  stepDetailsPanelWidth: number;
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
  const [mainSidePanelWidth, saveMainSidePanelWidth] = useCanvasContainerWidth(
    "pipelineEditor.panelWidth",
    DEFAULT_MAIN_SIDE_PANEL_WIDTH
  );

  const [
    stepDetailsPanelWidth,
    saveStepDetailsPanelWidth,
  ] = useCanvasContainerWidth(
    "pipelineDetails.panelWidth",
    DEFAULT_STEP_DETAILS_PANEL_WIDTH
  );

  return (
    <PipelineCanvasDimensionsContext.Provider
      value={{
        mainSidePanelWidth,
        minMainSidePanelWidth: MIN_MAIN_SIDE_PANEL_WIDTH,
        saveMainSidePanelWidth,
        stepDetailsPanelWidth,
        minStepDetailsPanelWidth: MIN_STEP_DETAILS_PANEL_WIDTH,
        saveStepDetailsPanelWidth,
      }}
    >
      {children}
    </PipelineCanvasDimensionsContext.Provider>
  );
};
