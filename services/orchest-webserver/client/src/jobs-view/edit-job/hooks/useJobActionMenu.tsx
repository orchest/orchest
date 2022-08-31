import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useEditJob } from "../../stores/useEditJob";
import { JobPrimaryButtonIconType } from "../JobPrimaryButtonIcon";
import { useJobActions } from "./useJobActions";

export const useJobActionMenu = () => {
  const status = useEditJob((state) => state.jobChanges?.status);
  const schedule = useEditJob((state) => state.jobChanges?.schedule);
  const nextScheduledTime = useEditJob(
    (state) => state.jobChanges?.next_scheduled_time
  );
  const { resumeJob, pauseJob, duplicateJob, triggerJobNow } = useJobActions();

  const isCronJob = hasValue(schedule);
  const isOneOffJob = !schedule && hasValue(nextScheduledTime);
  const isScheduledJob = isCronJob || isOneOffJob;

  const isAllowedToTriggerScheduledRuns =
    (isCronJob && ["PAUSED", "STARTED"].includes(status || "")) ||
    (isOneOffJob && status === "PENDING");

  const isRunning = ["PAUSED", "STARTED", "PENDING"].includes(status || "");
  const hasPaused = status === "PAUSED";

  const actions = React.useMemo<
    {
      label: string;
      icon: JobPrimaryButtonIconType;
      action: () => void | Promise<void>;
      disabled?: boolean;
    }[]
  >(
    () => [
      {
        label: hasPaused ? "Resume scheduled job" : "Pause scheduled job",
        icon: hasPaused ? "resume" : "pause",
        disabled: !isScheduledJob || !isRunning,
        action: hasPaused ? resumeJob : pauseJob,
      },
      {
        label: "Trigger job now",
        icon: "run",
        disabled: !isAllowedToTriggerScheduledRuns,
        action: triggerJobNow,
      },
      {
        label: "Copy job configuration",
        icon: "duplicate",
        action: duplicateJob,
      },
    ],
    [
      duplicateJob,
      hasPaused,
      isRunning,
      isScheduledJob,
      pauseJob,
      resumeJob,
      triggerJobNow,
      isAllowedToTriggerScheduledRuns,
    ]
  );

  return actions;
};
