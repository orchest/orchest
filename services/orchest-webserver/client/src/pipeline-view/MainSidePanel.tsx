import {
  ResizableContainer,
  ResizeWidthBar,
} from "@/components/ResizableContainer";
import React from "react";
import { usePipelineCanvasDimensionsContext } from "./contexts/PipelineCanvasDimensionsContext";

export const MainSidePanel: React.FC = ({ children }) => {
  const {
    mainSidePanelWidth,
    minMainSidePanelWidth,
    saveMainSidePanelWidth,
  } = usePipelineCanvasDimensionsContext();

  return (
    <ResizableContainer
      initialWidth={Math.max(mainSidePanelWidth, minMainSidePanelWidth)}
      minWidth={minMainSidePanelWidth}
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
