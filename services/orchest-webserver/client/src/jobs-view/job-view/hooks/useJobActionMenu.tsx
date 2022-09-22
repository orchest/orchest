import { useStartEditingJob } from "@/jobs-view/hooks/useStartEditingJob";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useEditJob } from "../../stores/useEditJob";
import { JobPrimaryButtonIconType } from "../JobPrimaryButtonIcon";
import { useEditJobType } from "./useEditJobType";
import { useJobActions } from "./useJobActions";

export const useJobActionMenu = () => {
  const status = useEditJob((state) => state.jobChanges?.status);
  const schedule = useEditJob((state) => state.jobChanges?.schedule);
  const { resumeJob, pauseJob, duplicateJob, triggerJobNow } = useJobActions();

  const isCronJob = hasValue(schedule);

  const isAllowedToTriggerScheduledRuns =
    isCronJob && ["PAUSED", "STARTED"].includes(status || "");

  const isRunning = ["PAUSED", "STARTED", "PENDING"].includes(status || "");
  const hasPaused = status === "PAUSED";

  const editJobType = useEditJobType();
  const isEditing = useEditJob((state) => state.isEditing);
  const shouldShowEditJob = !isEditing && editJobType === "active-cronjob";
  const { startEditingActiveCronJob } = useStartEditingJob();

  const actions = React.useMemo(
    () =>
      [
        shouldShowEditJob
          ? {
              label: "Edit job",
              icon: "edit",
              action: startEditingActiveCronJob,
            }
          : undefined,
        isCronJob
          ? {
              label: hasPaused ? "Resume job" : "Pause job",
              icon: hasPaused ? "resume" : "pause",
              disabled: !isRunning,
              action: hasPaused ? resumeJob : pauseJob,
            }
          : undefined,
        isCronJob
          ? {
              label: "Trigger job now",
              icon: "run",
              disabled: !isAllowedToTriggerScheduledRuns,
              action: triggerJobNow,
            }
          : undefined,
        {
          label: "Copy job configuration",
          icon: "duplicate",
          action: duplicateJob,
        },
      ].filter(Boolean) as {
        label: string;
        icon: JobPrimaryButtonIconType;
        action: () => void | Promise<void>;
        disabled?: boolean;
      }[],
    [
      duplicateJob,
      hasPaused,
      isRunning,
      isCronJob,
      pauseJob,
      resumeJob,
      triggerJobNow,
      isAllowedToTriggerScheduledRuns,
      shouldShowEditJob,
      startEditingActiveCronJob,
    ]
  );

  return actions;
};
