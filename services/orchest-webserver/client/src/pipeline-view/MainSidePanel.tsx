import {
  ElementSize,
  ResizableContainer,
  ResizeWidthBar,
} from "@/components/ResizableContainer";
import { useLocalStorage } from "@/hooks/useLocalStorage";
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
        if (!isNaN(Number(width))) {
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
        }}
        onResized={saveWidth}
      >
        {({ resizeWidth }) => {
          return (
            <>
              <Stack direction="column">{children}</Stack>
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
