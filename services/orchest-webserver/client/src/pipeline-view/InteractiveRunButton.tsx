import Button, { ButtonProps } from "@mui/material/Button";
import React from "react";
import { useInteractiveRunsContext } from "./contexts/InteractiveRunsContext";
import { RunStepsType } from "./hooks/useInteractiveRuns";

export const InteractiveRunButton: React.FC<
  ButtonProps & {
    hidden: boolean;
    selectedSteps: string[];
    stepsType: RunStepsType;
    isSessionRunning: boolean;
  }
> = ({
  children,
  hidden,
  isSessionRunning,
  selectedSteps,
  stepsType,
  ...rest
}) => {
  const { pipelineRunning, runSteps } = useInteractiveRunsContext();

  return !hidden && !pipelineRunning ? (
    <Button
      {...rest}
      variant="contained"
      onClick={() => runSteps(selectedSteps, stepsType, isSessionRunning)}
    >
      {children}
    </Button>
  ) : null;
};
