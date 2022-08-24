import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import PlayCircleOutlineOutlinedIcon from "@mui/icons-material/PlayCircleOutlineOutlined";
import ReplayOutlinedIcon from "@mui/icons-material/ReplayOutlined";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import StopCircleOutlinedIcon from "@mui/icons-material/StopCircleOutlined";
import Box from "@mui/material/Box";
import React from "react";

const iconMapping = {
  run: <PlayCircleOutlineOutlinedIcon fontSize="small" />,
  schedule: <ScheduleOutlinedIcon fontSize="small" />,
  pause: <StopCircleOutlinedIcon fontSize="small" />,
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
