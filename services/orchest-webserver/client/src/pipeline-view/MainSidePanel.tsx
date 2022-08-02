import { ResizablePane } from "@/components/ResizablePane";
import React from "react";
import {
  MIN_MAIN_SIDE_PANEL_WIDTH,
  usePipelineCanvasDimensionsContext,
} from "./contexts/PipelineCanvasDimensionsContext";

export const MainSidePanel: React.FC = ({ children }) => {
  const {
    mainSidePanelWidth,
    setMainSidePanelWidth,
  } = usePipelineCanvasDimensionsContext();

  const onSetSize = React.useCallback(
    (width: number) => setMainSidePanelWidth(width),
    [setMainSidePanelWidth]
  );

  return (
    <ResizablePane
      direction="horizontal"
      initialSize={Math.max(mainSidePanelWidth, MIN_MAIN_SIDE_PANEL_WIDTH)}
      minWidth={MIN_MAIN_SIDE_PANEL_WIDTH}
      maxWidth={window.innerWidth / 2}
      position="relative"
      sx={{
        backgroundColor: (theme) => theme.palette.grey[100],
        borderRight: (theme) => `1px solid ${theme.borderColor}`,
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
      onSetSize={onSetSize}
    >
      {children}
    </ResizablePane>
  );
};
