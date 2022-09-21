import { usePipelineDataContext } from "@/pipeline-view/contexts/PipelineDataContext";
import { DisplayedPipelineStatus } from "@/pipeline-view/hooks/useInteractiveRuns";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import PlayCircleOutlineOutlinedIcon from "@mui/icons-material/PlayCircleOutlineOutlined";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import React from "react";

type PipelineOperationButtonIconProps = {
  status?: DisplayedPipelineStatus;
};

export const PrimaryPipelineActionIcon = ({
  status,
}: PipelineOperationButtonIconProps) => {
  const { isReadOnly } = usePipelineDataContext();
  const isCanceling = status === "CANCELING";
  const isIdling = status === "IDLING";

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
      {isIdling || isReadOnly ? (
        <PlayCircleOutlineOutlinedIcon fontSize="small" />
      ) : (
        <CancelOutlinedIcon fontSize="small" />
      )}
    </Box>
  );
};
