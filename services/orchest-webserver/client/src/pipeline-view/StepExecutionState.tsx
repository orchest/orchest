import { StepRunState } from "@/hooks/useActivePipelineRun";
import Box from "@mui/material/Box";
import React from "react";
import { useInteractiveRuns } from "./hooks/useInteractiveRuns";
import { getStateText, StepStatus } from "./PipelineStep";

export const StepExecutionState = ({ stepUuid }: { stepUuid: string }) => {
  const { stepRunStates } = useInteractiveRuns();

  const executionState = stepRunStates
    ? stepRunStates[stepUuid] || { status: "IDLE" }
    : { status: "IDLE" };

  const stateText = getStateText(executionState as StepRunState);
  return (
    <Box className={"execution-indicator"}>
      <StepStatus value={executionState.status} />
      {stateText}
    </Box>
  );
};
