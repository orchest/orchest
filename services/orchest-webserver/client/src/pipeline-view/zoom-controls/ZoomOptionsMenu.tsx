import { modifierKey } from "@/utils/platform";
import Divider from "@mui/material/Divider";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import { hasValue, uuidv4 } from "@orchest/lib-utils";
import React from "react";
import { usePipelineCanvasContext } from "../contexts/PipelineCanvasContext";
import { usePipelineUiStateContext } from "../contexts/PipelineUiStateContext";

type MenuOption =
  | {
      type: "item";
      label: string;
      action?: () => void;
      hotKey?: string;
    }
  | {
      type: "divider";
    };

type PipelineViewingOptionsMenuProps = {
  anchor: Element | undefined;
  onClose: () => void;
};

export const ZoomOptionsMenu = ({
  anchor,
  onClose,
}: PipelineViewingOptionsMenuProps) => {
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  const { zoomIn, zoomOut, centerView, resetZoom } = usePipelineCanvasContext();
  const { autoLayoutPipeline } = usePipelineUiStateContext();

  const menuItems: readonly MenuOption[] = React.useMemo(
    () => [
      {
        type: "item",
        label: "Zoom to fit",
        action: centerView,
        hotKey: "h",
      },
      {
        type: "item",
        label: "Zoom in",
        action: zoomIn,
        hotKey: `${modifierKey} Up`,
      },
      {
        type: "item",
        label: "Zoom out",
        action: zoomOut,
        hotKey: `${modifierKey} Down`,
      },
      {
        type: "item",
        label: "Zoom to 100%",
        action: resetZoom,
      },
      { type: "divider" },
      {
        type: "item",
        label: "Auto layout",
        action: autoLayoutPipeline,
        hotKey: `${modifierKey} shift o`,
      },
    ],
    [autoLayoutPipeline, centerView, zoomIn, zoomOut, resetZoom]
  );

  return (
    <Menu
      ref={menuRef}
      anchorEl={anchor}
      open={hasValue(anchor)}
      onClose={onClose}
      MenuListProps={{
        dense: true,
        "aria-labelledby": "pipeline-operations",
      }}
      anchorOrigin={{ vertical: "top", horizontal: "center" }}
      transformOrigin={{ vertical: "bottom", horizontal: "center" }}
    >
      {menuItems.map((option) => {
        if (option.type === "divider") return <Divider key={uuidv4()} />;

        return (
          <MenuItem
            key={option.label}
            disabled={!hasValue(option.action)}
            onClick={option.action}
          >
            <ListItemText>{option.label}</ListItemText>
            <Typography variant="caption" color="text.secondary">
              {option.hotKey}
            </Typography>
          </MenuItem>
        );
      })}
    </Menu>
  );
};
