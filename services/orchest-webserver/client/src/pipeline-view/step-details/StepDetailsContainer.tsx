import Box from "@mui/material/Box";
import React from "react";
import {
  ClientPosition,
  useDragElementWithPosition,
} from "../../hooks/useDragElementWithPosition";
import { ResizeBar } from "../components/ResizeBar";
import { usePipelineCanvasDimensionsContext } from "../contexts/PipelineCanvasDimensionsContext";

type StepDetailsContainerProps = {
  children: React.ReactNode;
};

export const StepDetailsContainer = ({
  children,
}: StepDetailsContainerProps) => {
  const {
    stepDetailsPanelWidth,
    saveStepDetailsPanelWidth,
    minStepDetailsPanelWidth,
  } = usePipelineCanvasDimensionsContext();
  const [panelWidth, setPanelWidth] = React.useState(stepDetailsPanelWidth);

  const onDragging = React.useCallback(
    (position: React.MutableRefObject<ClientPosition>) => {
      setPanelWidth((prevPanelWidth) => {
        const newPanelWidth = Math.max(
          minStepDetailsPanelWidth,
          prevPanelWidth - position.current.delta.x
        );
        position.current.delta.x = 0;
        return newPanelWidth;
      });
    },
    [minStepDetailsPanelWidth]
  );

  const onStopDragging = React.useCallback(() => {
    setPanelWidth((panelWidth) => {
      saveStepDetailsPanelWidth({ width: panelWidth });
      return panelWidth;
    });
  }, [saveStepDetailsPanelWidth]);

  const resizeWidth = useDragElementWithPosition(onDragging, onStopDragging);

  return (
    <Box
      style={{ width: `${panelWidth}px`, minWidth: minStepDetailsPanelWidth }}
      sx={{
        height: "100%",
        backgroundColor: (theme) => theme.palette.common.white,
        borderLeft: (theme) => `1px solid ${theme.palette.grey[300]}`,
        width: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <ResizeBar onMouseDown={resizeWidth} />
      {children}
    </Box>
  );
};
