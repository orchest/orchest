import { useThrottle } from "@/hooks/useThrottle";
import Button from "@mui/material/Button";
import React from "react";
import { useEditJob } from "../stores/useEditJob";
import { useJobPrimaryButtonActions } from "./hooks/useJobPrimaryButtonActions";
import { JobPrimaryButtonIcon } from "./JobPrimaryButtonIcon";

const DiscardChangesButton = () => {
  const isEditing = useEditJob((state) => state.isEditing);
  const discardActiveCronJobChanges = useEditJob(
    (state) => state.discardActiveCronJobChanges
  );

  return isEditing ? (
    <Button color="primary" onClick={discardActiveCronJobChanges}>
      Discard changes
    </Button>
  ) : null;
};

/**
 * Normally every view has only one primary button. But Job view is an exception.
 * When editing an active cron job, add a `Discard changes` button next to the primary button.
 */
export const JobPrimaryButtons = () => {
  const status = useEditJob((state) => state.jobChanges?.status);
  const hasStarted =
    status === "STARTED" || status === "PENDING" || status === "PAUSED";

  const [buttonLabel, mainAction, iconType] = useJobPrimaryButtonActions();

  const { withThrottle } = useThrottle();

  // Prevent the unintentional second click.
  const handleClick = mainAction ? withThrottle(mainAction) : undefined;

  return (
    <>
      <DiscardChangesButton />
      <Button
        color="primary"
        variant={hasStarted ? "outlined" : "contained"}
        startIcon={
          iconType ? <JobPrimaryButtonIcon type={iconType} /> : undefined
        }
        disabled={!status}
        onClick={handleClick}
      >
        {buttonLabel}
      </Button>
    </>
  );
};
