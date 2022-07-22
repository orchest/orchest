import {
  ElementSize,
  ResizableContainer,
  ResizeWidthBar,
} from "@/components/ResizableContainer";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { isNumber } from "@/utils/webserver-utils";
import React from "react";

const DEFAULT_PANEL_WIDTH = 300;
const MIN_PANEL_WIDTH = 252;

export const MainSidePanel: React.FC = ({ children }) => {
  const [storedPanelWidth, setStoredPanelWidth] = useLocalStorage(
    "pipelineEditor.panelWidth",
    DEFAULT_PANEL_WIDTH
  );

  const saveWidth = React.useCallback(
    ({ width }: ElementSize) => {
      if (isNumber(width)) {
        setStoredPanelWidth(Number(width));
      }
    },
    [setStoredPanelWidth]
  );

  return (
    <ResizableContainer
      initialWidth={Math.max(storedPanelWidth, MIN_PANEL_WIDTH)}
      minWidth={MIN_PANEL_WIDTH}
      maxWidth={window.innerWidth - 100}
      sx={{
        position: "relative",
        backgroundColor: (theme) => theme.palette.grey[100],
        borderRight: (theme) => `1px solid ${theme.borderColor}`,
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
      onResized={saveWidth}
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
