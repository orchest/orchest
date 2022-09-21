import { ResizablePane } from "@/components/ResizablePane";
import React from "react";
import {
  MAX_WIDTH,
  MIN_MAIN_SIDE_PANEL_WIDTH,
  useMainSidePanelWidth,
} from "./stores/useLayoutStore";

type MainSidePanelProps = { children: React.ReactNode };
export const MainSidePanel = ({ children }: MainSidePanelProps) => {
  const [mainSidePanelWidth, setMainSidePanelWidth] = useMainSidePanelWidth();

  return (
    <ResizablePane
      direction="horizontal"
      initialSize={mainSidePanelWidth}
      minWidth={MIN_MAIN_SIDE_PANEL_WIDTH}
      maxWidth={MAX_WIDTH}
      position="relative"
      sx={{
        backgroundColor: (theme) => theme.palette.grey[100],
        borderRight: (theme) => `1px solid ${theme.borderColor}`,
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
      onSetSize={setMainSidePanelWidth}
    >
      {children}
    </ResizablePane>
  );
};
