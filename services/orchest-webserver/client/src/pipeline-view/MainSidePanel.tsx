import {
  ResizableContainer,
  ResizeWidthBar,
} from "@/components/ResizableContainer";
import React from "react";
import {
  MIN_MAIN_SIDE_PANEL_WIDTH,
  usePipelineCanvasDimensionsContext,
} from "./contexts/PipelineCanvasDimensionsContext";

export const MainSidePanel: React.FC = ({ children }) => {
  const {
    mainSidePanelWidth,
    saveMainSidePanelWidth,
  } = usePipelineCanvasDimensionsContext();

  return (
    <ResizableContainer
      initialWidth={Math.max(mainSidePanelWidth, MIN_MAIN_SIDE_PANEL_WIDTH)}
      minWidth={MIN_MAIN_SIDE_PANEL_WIDTH}
      maxWidth={window.innerWidth - 100}
      sx={{
        position: "relative",
        backgroundColor: (theme) => theme.palette.grey[100],
        borderRight: (theme) => `1px solid ${theme.borderColor}`,
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
      onResized={saveMainSidePanelWidth}
    >
      {({ resizeWidth }) => {
        return (
          <>
            {children}
            <ResizeWidthBar
              side="right"
              resizeWidth={resizeWidth}
              sx={{
                right: 0,
                marginLeft: (theme) => theme.spacing(-0.5),
              }}
            />
          </>
        );
      }}
    </ResizableContainer>
  );
};
