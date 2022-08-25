import { useJobsApi } from "@/api/jobs/useJobsApi";
import { useSelectJob } from "@/jobs-view/hooks/useSelectJob";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useScheduleJob } from "../../hooks/useScheduleJob";
import { useEditJob } from "../../stores/useEditJob";

export const useJobActions = () => {
  const { jobChanges } = useEditJob();
  const scheduleJob = useScheduleJob();
  const { selectJob } = useSelectJob();

  const {
    resumeCronJob,
    pauseCronJob,
    cancel,
    duplicate,
    triggerScheduledRuns,
  } = useJobsApi();

  const isScheduledJob =
    hasValue(jobChanges?.schedule) || hasValue(jobChanges?.next_scheduled_time);

  const hasStarted =
    jobChanges?.status === "STARTED" || jobChanges?.status === "PENDING";

  const pauseJob = React.useCallback(() => {
    if (isScheduledJob && hasStarted) pauseCronJob(jobChanges.uuid);
  }, [isScheduledJob, hasStarted, pauseCronJob, jobChanges?.uuid]);

  const resumeJob = React.useCallback(() => {
    if (jobChanges?.status === "PAUSED") resumeCronJob(jobChanges.uuid);
  }, [jobChanges?.status, resumeCronJob, jobChanges?.uuid]);

  const cancelJob = React.useCallback(() => {
    if (hasStarted) cancel(jobChanges.uuid);
  }, [hasStarted, cancel, jobChanges?.uuid]);

  const duplicateJob = React.useCallback(async () => {
    if (!jobChanges?.uuid) return;
    const duplicatedJob = await duplicate(jobChanges.uuid);
    selectJob(duplicatedJob.pipeline_uuid, duplicatedJob.uuid);
  }, [duplicate, selectJob, jobChanges?.uuid]);

  const triggerJobNow = React.useCallback(async () => {
    if (!jobChanges?.uuid) return;
    await triggerScheduledRuns(jobChanges.uuid);
  }, [triggerScheduledRuns, jobChanges?.uuid]);

  return {
    scheduleJob,
    pauseJob,
    resumeJob,
    cancelJob,
    duplicateJob,
    triggerJobNow,
  };
};
