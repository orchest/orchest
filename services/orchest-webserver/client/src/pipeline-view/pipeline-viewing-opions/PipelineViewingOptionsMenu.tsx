import { osSpecificHotKey } from "@/utils/isMacOs";
import Divider from "@mui/material/Divider";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import { hasValue, uuidv4 } from "@orchest/lib-utils";
import React from "react";
import { usePipelineCanvasContext } from "../contexts/PipelineCanvasContext";
import { usePipelineUiStateContext } from "../contexts/PipelineUiStateContext";

type MenuItemData =
  | {
      type: "item";
      label: string;
      action?: () => void;
      hotKey?: string;
    }
  | {
      type: "separator";
    };

type PipelineViewingOptionsMenuProps = {
  anchor: Element | undefined;
  onClose: () => void;
};

export const PipelineViewingOptionsMenu = ({
  anchor,
  onClose,
}: PipelineViewingOptionsMenuProps) => {
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  const { zoomIn, zoomOut, centerView } = usePipelineCanvasContext();
  const { autoLayoutPipeline } = usePipelineUiStateContext();

  const menuItems: readonly MenuItemData[] = React.useMemo(
    () => [
      {
        type: "item",
        label: "Zoom in",
        action: () => zoomIn(),
        hotKey: `${osSpecificHotKey} Arrow up`,
      },
      {
        type: "item",
        label: "Zoom out",
        action: () => zoomOut(),
        hotKey: `${osSpecificHotKey} Arrow down`,
      },
      { type: "separator" },
      {
        type: "item",
        label: "Center view",
        action: () => centerView(),
        hotKey: "h",
      },
      {
        type: "item",
        label: "Auto layout",
        action: () => autoLayoutPipeline(),
        hotKey: `${osSpecificHotKey} shift o`,
      },
    ],
    [autoLayoutPipeline, centerView, zoomIn, zoomOut]
  );
  return (
    <Menu
      id="pipeline-viewing-options-menu"
      ref={menuRef}
      anchorEl={anchor}
      open={hasValue(anchor)}
      onClose={onClose}
      MenuListProps={{
        dense: true,
        "aria-labelledby": "pipeline-operations",
        sx: { width: (theme) => theme.spacing(28) },
      }}
      anchorOrigin={{ vertical: "top", horizontal: "center" }}
      transformOrigin={{ vertical: "bottom", horizontal: "center" }}
    >
      {menuItems.map((option) => {
        if (option.type === "separator") return <Divider key={uuidv4()} />;
        const disabled = !hasValue(option.action);
        return (
          <MenuItem
            key={option.label}
            disabled={disabled}
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
