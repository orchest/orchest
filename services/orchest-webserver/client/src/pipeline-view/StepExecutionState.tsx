import Box from "@mui/material/Box";
import React from "react";
import { useInteractiveRunsContext } from "./contexts/InteractiveRunsContext";
import { ExecutionState, getStateText, StepStatus } from "./PipelineStep";

export const StepExecutionState = ({ stepUuid }: { stepUuid: string }) => {
  const { stepExecutionState } = useInteractiveRunsContext();

  const executionState = stepExecutionState
    ? stepExecutionState[stepUuid] || { status: "IDLE" }
    : { status: "IDLE" };

  const stateText = getStateText(executionState as ExecutionState);
  return (
    <Box className={"execution-indicator"}>
      <StepStatus value={executionState.status} />
      {stateText}
    </Box>
  );
};
