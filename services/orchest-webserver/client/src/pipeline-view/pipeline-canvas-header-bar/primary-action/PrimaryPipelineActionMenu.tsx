import { RunIncomingIcon } from "@/components/common/icons/RunIncomingIcon";
import { modifierKey } from "@/utils/platform";
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
import { useRunSteps } from "./useRunSteps";

type PrimaryPipelineActionMenuProps = {
  anchor: Element | undefined;
  onClose: () => void;
};

export const PrimaryPipelineActionMenu = ({
  anchor,
  onClose,
}: PrimaryPipelineActionMenuProps) => {
  const {
    runSelectedSteps,
    runAllSteps,
    runIncomingSteps,
    scheduleJob,
  } = useRunSteps();

  const operationOptions = React.useMemo(
    () =>
      [
        {
          label: "Run all",
          icon: <PlayCircleOutlineOutlinedIcon fontSize="small" />,
          hotKey: "Shift Enter",
          action: runAllSteps,
        },
        {
          label: "Run selected",
          icon: <PlayArrowOutlinedIcon fontSize="small" />,
          hotKey: "Enter",
          action: runSelectedSteps,
        },
        {
          label: "Run incoming",
          icon: <RunIncomingIcon />,
          hotKey: "I",
          action: runIncomingSteps,
        },
        {
          label: "Schedule Job",
          icon: <MoreTimeOutlinedIcon fontSize="small" />,
          hotKey: "J",
          action: scheduleJob,
        },
      ] as const,
    [runAllSteps, runIncomingSteps, runSelectedSteps, scheduleJob]
  );

  return (
    <Menu
      anchorEl={anchor}
      open={hasValue(anchor)}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      transformOrigin={{ vertical: "top", horizontal: "right" }}
      MenuListProps={{
        dense: true,
        "aria-labelledby": "pipeline-operations",
      }}
    >
      {operationOptions.map((option) => {
        const disabled = !hasValue(option.action);
        const onClick = () => {
          option.action?.();
          onClose();
        };

        return (
          <MenuItem key={option.label} disabled={disabled} onClick={onClick}>
            <ListItemIcon>{option.icon}</ListItemIcon>
            <ListItemText>{option.label}</ListItemText>
            <Typography variant="caption" color="text.secondary">
              {`${modifierKey} ${option.hotKey}`}
            </Typography>
          </MenuItem>
        );
      })}
    </Menu>
  );
};
