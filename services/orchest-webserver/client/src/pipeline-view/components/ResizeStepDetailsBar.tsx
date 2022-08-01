import {
  ClientPosition,
  useDragElementWithPosition,
} from "@/hooks/useDragElementWithPosition";
import Box from "@mui/material/Box";
import React from "react";
import { usePipelineCanvasDimensionsContext } from "../contexts/PipelineCanvasDimensionsContext";

export const ResizeStepDetailsBar = () => {
  const {
    setStepDetailsPanelWidth,
    saveStepDetailsPanelWidth,
  } = usePipelineCanvasDimensionsContext();

  const onDragging = React.useCallback(
    (position: React.MutableRefObject<ClientPosition>) => {
      setStepDetailsPanelWidth((prevPanelWidth) => {
        const deltaX = position.current.delta.x;
        return prevPanelWidth - deltaX;
      });
      position.current.delta.x = 0;
    },
    [setStepDetailsPanelWidth]
  );

  const onStopDragging = React.useCallback(() => {
    setStepDetailsPanelWidth((panelWidth) => {
      saveStepDetailsPanelWidth({ width: panelWidth });
      return panelWidth;
    });
  }, [setStepDetailsPanelWidth, saveStepDetailsPanelWidth]);

  const resizeWidth = useDragElementWithPosition(onDragging, onStopDragging);
  return (
    <Box
      sx={{
        position: "absolute",
        top: 0,
        height: "100%",
        width: (theme) => theme.spacing(1),
        marginLeft: (theme) => theme.spacing(-0.5),
        userSelect: "none",
        cursor: "col-resize",
      }}
      onMouseDown={resizeWidth}
    />
  );
};
