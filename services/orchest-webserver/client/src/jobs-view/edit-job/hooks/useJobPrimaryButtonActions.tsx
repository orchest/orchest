import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useEditJob } from "../../stores/useEditJob";
import { JobPrimaryButtonIconType } from "../JobPrimaryButtonIcon";
import { useJobActions } from "./useJobActions";

export const useJobPrimaryButtonActions = () => {
  const {
    scheduleJob,
    resumeJob,
    pauseJob,
    cancelJob,
    duplicateJob,
  } = useJobActions();
  const { jobChanges } = useEditJob();

  const hasStarted =
    jobChanges?.status === "STARTED" || jobChanges?.status === "PENDING";

  const [buttonLabel, mainAction, iconType] = React.useMemo<
    [string | undefined, (() => void) | undefined, JobPrimaryButtonIconType]
  >(() => {
    const isScheduledJob =
      hasValue(jobChanges?.schedule) ||
      hasValue(jobChanges?.next_scheduled_time);

    const hasPaused = jobChanges?.status === "PAUSED";

    if (jobChanges?.status === "DRAFT") {
      const shouldRunNow =
        !hasValue(jobChanges?.schedule) &&
        !hasValue(jobChanges?.next_scheduled_time);

      if (shouldRunNow) return ["Run job", scheduleJob, "run"];
      return ["Schedule job", scheduleJob, "schedule"];
    }

    if (hasPaused) {
      return ["Resume job", resumeJob, "resume"];
    }
    if (isScheduledJob && hasStarted) {
      return ["Pause job", pauseJob, "pause"];
    }
    if (!isScheduledJob && hasStarted) {
      return ["Cancel job", cancelJob, "cancel"];
    }

    return ["Copy job configuration", duplicateJob, "duplicate"];
  }, [
    jobChanges?.next_scheduled_time,
    jobChanges?.schedule,
    jobChanges?.status,
    hasStarted,
    scheduleJob,
    resumeJob,
    pauseJob,
    cancelJob,
    duplicateJob,
  ]);

  return [buttonLabel, mainAction, iconType] as const;
};
