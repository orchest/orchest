import { DisplayedPipelineStatus } from "@/pipeline-view/hooks/useInteractiveRuns";
import PlayCircleOutlineOutlinedIcon from "@mui/icons-material/PlayCircleOutlineOutlined";
import StopCircleOutlinedIcon from "@mui/icons-material/StopCircleOutlined";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import React from "react";

type PipelineOperationButtonIconProps = {
  status: DisplayedPipelineStatus;
};

export const PipelineOperationButtonIcon = ({
  status,
}: PipelineOperationButtonIconProps) => {
  const isCanceling = status === "CANCELING";
  const pipelineIdling = status === "IDLING";
  return (
    <Box
      sx={{
        display: "inline-flex",
        position: "relative",
      }}
    >
      {isCanceling && (
        <CircularProgress
          size={20}
          sx={{
            color: (theme) => theme.palette.grey[400],
            position: "absolute",
            top: 0,
            left: 0,
            zIndex: 1,
          }}
        />
      )}
      {pipelineIdling ? (
        <PlayCircleOutlineOutlinedIcon fontSize="small" />
      ) : (
        <StopCircleOutlinedIcon fontSize="small" />
      )}
    </Box>
  );
};
