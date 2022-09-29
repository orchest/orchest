import { ResizablePane } from "@/components/ResizablePane";
import { SxProps, Theme } from "@mui/material";
import React from "react";
import {
  MAX_WIDTH,
  MIN_MAIN_SIDE_PANEL_WIDTH,
  useMainSidePanelWidth,
} from "./stores/useLayoutStore";

const paneSx: SxProps<Theme> = {
  backgroundColor: (theme) => theme.palette.grey[100],
  borderRight: (theme) => `1px solid ${theme.borderColor}`,
  display: "flex",
  flexDirection: "column",
  height: "100%",
};

/** A resizable & scrollable side pane, commonly used for menus. */
export const MainSidePanel: React.FC = ({ children }) => {
  const [mainSidePanelWidth, setMainSidePanelWidth] = useMainSidePanelWidth();

  return (
    <ResizablePane
      direction="horizontal"
      initialSize={mainSidePanelWidth}
      minWidth={MIN_MAIN_SIDE_PANEL_WIDTH}
      maxWidth={MAX_WIDTH}
      position="relative"
      sx={paneSx}
      onSetSize={setMainSidePanelWidth}
    >
      {children}
    </ResizablePane>
  );
};
