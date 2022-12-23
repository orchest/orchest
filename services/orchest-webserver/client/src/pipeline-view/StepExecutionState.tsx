import { SystemStatusIcon } from "@/components/common/SystemStatusIcon";
import { useStepFileStatus } from "@/hooks/useStepFileStatus";
import { PipelineStepStatus } from "@/types";
import {
  statusColor,
  statusTextColor,
  statusTitle,
} from "@/utils/system-status";
import { alpha, Chip, Typography } from "@mui/material";
import React from "react";
import { useInteractiveRuns } from "./hooks/useInteractiveRuns";

const formatSeconds = (seconds: number) => {
  const hrs = ~~(seconds / 3600);
  const mins = ~~((seconds % 3600) / 60);
  const secs = ~~seconds % 60;

  let duration = "";

  if (hrs > 0) duration += hrs + "h ";
  if (mins > 0) duration += mins + "m ";

  return duration + secs + "s";
};

const formatDuration = (start: Date, end: Date) =>
  formatSeconds(Math.round((+end - +start) / 1000));

export const StepExecutionState = ({ stepUuid }: { stepUuid: string }) => {
  const { stepRunStates } = useInteractiveRuns();
  const fileStatus = useStepFileStatus(stepUuid);

  const executionState = stepRunStates
    ? stepRunStates[stepUuid] || { status: "IDLE" as PipelineStepStatus }
    : { status: "IDLE" as PipelineStepStatus };

  const { started_time, finished_time, server_time } = executionState;

  const duration =
    started_time && finished_time
      ? `${formatDuration(started_time, finished_time)}`
      : started_time && server_time
      ? `${formatDuration(started_time, server_time)}`
      : "";

  const showDuration =
    duration &&
    executionState.status !== "ABORTED" &&
    fileStatus !== "not-found";

  return (
    <Typography
      component="div"
      variant="body2"
      sx={{
        display: "flex",
        width: "100%",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 600ms ease-out",
        gap: 0.25,
        height: 30,
        paddingTop: 0.5,
        position: "absolute",
        left: 0,
        bottom: 0,
        fontSize: 14,
        lineHeight: 1.8,
        userSelect: "none",
        color: statusTextColor(executionState.status),
      }}
    >
      {fileStatus !== "not-found" ? (
        <>
          <SystemStatusIcon
            status={executionState.status}
            flavor="pipeline"
            size="small"
          />
          {statusTitle(executionState.status, "pipeline")}
        </>
      ) : (
        "File not found"
      )}
      {showDuration && (
        <Chip
          label={duration}
          size="small"
          sx={{
            height: "20px",
            marginLeft: "2px",
            backgroundColor: alpha(statusColor(executionState.status), 0.12),
          }}
        />
      )}
    </Typography>
  );
};
