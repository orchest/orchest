import { useThrottle } from "@/hooks/useThrottle";
import Button from "@mui/material/Button";
import React from "react";
import { useEditJob } from "../stores/useEditJob";
import { useJobPrimaryButtonActions } from "./hooks/useJobPrimaryButtonActions";
import { JobPrimaryButtonIcon } from "./JobPrimaryButtonIcon";

export const JobPrimaryButton = () => {
  const hasStarted = useEditJob(
    (state) =>
      state.jobChanges?.status === "STARTED" ||
      state.jobChanges?.status === "PENDING" ||
      state.jobChanges?.status === "PAUSED"
  );
  const [buttonLabel, mainAction, iconType] = useJobPrimaryButtonActions();

  const { withThrottle } = useThrottle();

  // Prevent the unintentional second click.
  const handleClick = mainAction ? withThrottle(mainAction) : undefined;

  return (
    <Button
      color="primary"
      variant={hasStarted ? "outlined" : "contained"}
      startIcon={<JobPrimaryButtonIcon type={iconType} />}
      onClick={handleClick}
    >
      {buttonLabel}
    </Button>
  );
};
