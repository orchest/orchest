import { useThrottle } from "@/hooks/useThrottle";
import Button from "@mui/material/Button";
import React from "react";
import { useEditJob } from "../stores/useEditJob";
import { useJobPrimaryButtonActions } from "./hooks/useJobPrimaryButtonActions";
import { JobPrimaryButtonIcon } from "./JobPrimaryButtonIcon";

export const JobPrimaryButton = () => {
  const status = useEditJob((state) => state.jobChanges?.status);
  const hasStarted =
    status === "STARTED" || status === "PENDING" || status === "PAUSED";

  const [buttonLabel, mainAction, iconType] = useJobPrimaryButtonActions();

  const { withThrottle } = useThrottle();

  // Prevent the unintentional second click.
  const handleClick = mainAction ? withThrottle(mainAction) : undefined;

  return (
    <Button
      color="primary"
      variant={hasStarted ? "outlined" : "contained"}
      startIcon={<JobPrimaryButtonIcon type={iconType} />}
      disabled={!status}
      onClick={handleClick}
    >
      {buttonLabel}
    </Button>
  );
};
