import {
  ElementSize,
  ResizableContainer,
  ResizeWidthBar,
} from "@/components/ResizableContainer";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { isNumber } from "@/utils/webserver-utils";
import Stack, { StackProps } from "@mui/material/Stack";
import React from "react";

const DEFAULT_PANEL_WIDTH = 300;
const MIN_PANEL_WIDTH = 180;

export const MainSidePanel = React.forwardRef<typeof Stack, StackProps>(
  function PanelContainerComponent({ children }) {
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
        initialWidth={storedPanelWidth}
        minWidth={MIN_PANEL_WIDTH}
        maxWidth={window.innerWidth - 100}
        sx={{
          position: "relative",
          backgroundColor: (theme) => theme.palette.background.paper,
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
  }
);
