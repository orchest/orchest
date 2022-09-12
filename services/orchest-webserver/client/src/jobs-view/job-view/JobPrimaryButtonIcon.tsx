import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import EditIcon from "@mui/icons-material/Edit";
import PauseCircleOutlinedIcon from "@mui/icons-material/PauseCircleOutlined";
import PlayArrowOutlinedIcon from "@mui/icons-material/PlayArrowOutlined";
import ReplayOutlinedIcon from "@mui/icons-material/ReplayOutlined";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import Box from "@mui/material/Box";
import React from "react";

const iconMapping = {
  edit: <EditIcon fontSize="small" />,
  run: <PlayArrowOutlinedIcon fontSize="small" />,
  schedule: <ScheduleOutlinedIcon fontSize="small" />,
  pause: <PauseCircleOutlinedIcon fontSize="small" />,
  resume: <ReplayOutlinedIcon fontSize="small" />,
  cancel: <CancelOutlinedIcon fontSize="small" />,
  duplicate: <ContentCopyOutlinedIcon fontSize="small" />,
};

export type JobPrimaryButtonIconType = keyof typeof iconMapping;

type JobPrimaryButtonIconProps = {
  type: JobPrimaryButtonIconType;
};

export const JobPrimaryButtonIcon = ({ type }: JobPrimaryButtonIconProps) => {
  return (
    <Box
      sx={{
        display: "inline-flex",
        position: "relative",
      }}
    >
      {iconMapping[type]}
    </Box>
  );
};
