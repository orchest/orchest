import { useGlobalContext } from "@/contexts/GlobalContext";
import { useThrottle } from "@/hooks/useThrottle";
import Button from "@mui/material/Button";
import React from "react";
import { useEditJob } from "../stores/useEditJob";
import { useEditJobType } from "./hooks/useEditJobType";
import { useJobPrimaryButtonActions } from "./hooks/useJobPrimaryButtonActions";
import { JobPrimaryButtonIcon } from "./JobPrimaryButtonIcon";

const useIsEditingActiveCronJob = () => {
  const isEditing = useEditJob((state) => state.isEditing);
  const editJobType = useEditJobType();
  return editJobType === "active-cronjob" && isEditing;
};

const DiscardChangesButton = () => {
  const { setAsSaved } = useGlobalContext();
  const isEditingActiveCronJob = useIsEditingActiveCronJob();
  const discardActiveCronJobChanges = useEditJob(
    (state) => state.discardActiveCronJobChanges
  );

  const discardChanges = () => {
    setAsSaved();
    discardActiveCronJobChanges();
  };

  return isEditingActiveCronJob ? (
    <Button color="primary" onClick={discardChanges}>
      Discard changes
    </Button>
  ) : null;
};

const SaveCronJobChangesButton = () => {
  const { setAsSaved } = useGlobalContext();
  const isEditingActiveCronJob = useIsEditingActiveCronJob();
  const saveActiveCronJobChanges = useEditJob(
    (state) => state.saveActiveCronJobChanges
  );
  const saveChanges = () => {
    setAsSaved();
    saveActiveCronJobChanges();
  };
  return isEditingActiveCronJob ? (
    <Button color="primary" variant="contained" onClick={saveChanges}>
      Save job
    </Button>
  ) : null;
};

const JobPrimaryButton = () => {
  const isEditingActiveCronJob = useIsEditingActiveCronJob();
  const status = useEditJob((state) => state.jobChanges?.status);

  const hasStarted =
    status === "STARTED" || status === "PENDING" || status === "PAUSED";

  const [buttonLabel, mainAction, iconType] = useJobPrimaryButtonActions();

  const { withThrottle } = useThrottle();

  // Prevent the unintentional second click.
  const handleClick = mainAction ? withThrottle(mainAction) : undefined;

  return isEditingActiveCronJob ? null : (
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
  );
};

/**
 * Normally every view has only one primary button. But Job view is an exception.
 * When editing an active cron job, add a `Discard changes` button next to the primary button.
 */
export const JobPrimaryButtons = () => {
  return (
    <>
      <DiscardChangesButton />
      <SaveCronJobChangesButton />
      <JobPrimaryButton />
    </>
  );
};
