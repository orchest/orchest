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

  const status = useEditJob((state) => state.jobChanges?.status);
  const schedule = useEditJob((state) => state.jobChanges?.schedule);
  const nextScheduledTime = useEditJob(
    (state) => state.jobChanges?.next_scheduled_time
  );

  const hasStarted = status === "STARTED" || status === "PENDING";

  const [buttonLabel, mainAction, iconType] = React.useMemo<
    [string, () => void, JobPrimaryButtonIconType]
  >(() => {
    const isScheduledJob = hasValue(schedule) || hasValue(nextScheduledTime);

    const hasPaused = status === "PAUSED";

    if (status === "DRAFT") {
      const shouldRunNow = !hasValue(schedule) && !hasValue(nextScheduledTime);

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
    nextScheduledTime,
    schedule,
    status,
    hasStarted,
    scheduleJob,
    resumeJob,
    pauseJob,
    cancelJob,
    duplicateJob,
  ]);

  return [buttonLabel, mainAction, iconType] as const;
};
