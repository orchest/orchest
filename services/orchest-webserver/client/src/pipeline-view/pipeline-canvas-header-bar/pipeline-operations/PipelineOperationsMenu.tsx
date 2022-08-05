import { RunIncomingIcon } from "@/components/common/icons/RunIncomingIcon";
import { isMacOs } from "@/utils/isMacOs";
import MoreTimeOutlinedIcon from "@mui/icons-material/MoreTimeOutlined";
import PlayArrowOutlinedIcon from "@mui/icons-material/PlayArrowOutlined";
import PlayCircleOutlineOutlinedIcon from "@mui/icons-material/PlayCircleOutlineOutlined";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import { hasValue } from "@orchest/lib-utils";
import React from "react";

const osSpecificHotKey = isMacOs() ? "⌘" : "Ctrl";

export const PipelineOperationsMenu = ({
  anchor,
  onClose,
}: {
  anchor: Element | undefined;
  onClose: () => void;
}) => {
  const operationOptions = React.useMemo(
    () =>
      [
        {
          label: "Run all",
          icon: <PlayCircleOutlineOutlinedIcon fontSize="small" />,
          hotKey: "Shift Enter",
          action: () => {
            console.log("DEV ");
          },
        },
        {
          label: "Run selected",
          icon: <PlayArrowOutlinedIcon fontSize="small" />,
          hotKey: "Enter",
          action: () => {
            console.log("DEV ");
          },
        },
        {
          label: "Run incoming",
          icon: <RunIncomingIcon />,
          hotKey: "I",
          action: () => {
            console.log("DEV ");
          },
        },
        {
          label: "Schedule Job",
          icon: <MoreTimeOutlinedIcon fontSize="small" />,
          hotKey: "J",
          action: () => {
            console.log("DEV ");
          },
        },
      ] as const,
    []
  );

  return (
    <Menu
      id="pipeline-operations-menu"
      anchorEl={anchor}
      open={hasValue(anchor)}
      onClose={onClose}
      MenuListProps={{
        dense: true,
        "aria-labelledby": "pipeline-operations",
        sx: { width: (theme) => theme.spacing(28) },
      }}
    >
      {operationOptions.map((option) => {
        return (
          <MenuItem key={option.label} onClick={option.action}>
            <ListItemIcon>{option.icon}</ListItemIcon>
            <ListItemText>{option.label}</ListItemText>
            <Typography variant="caption" color="text.secondary">
              {`${osSpecificHotKey} ${option.hotKey}`}
            </Typography>
          </MenuItem>
        );
      })}
    </Menu>
  );
};
