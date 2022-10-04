import { useJobRunsApi } from "@/api/job-runs/useJobRunsApi";
import { useJobsApi } from "@/api/jobs/useJobsApi";
import { useCancelJob } from "@/hooks/useCancelJob";
import { useSelectJob } from "@/jobs-view/hooks/useSelectJob";
import React from "react";
import { useScheduleJob } from "../../hooks/useScheduleJob";
import { useEditJob } from "../../stores/useEditJob";

export const useJobActions = () => {
  const uuid = useEditJob((state) => state.jobChanges?.uuid);
  const scheduleJob = useScheduleJob();
  const { selectJob } = useSelectJob();

  const cancel = useCancelJob();
  const resumeCronJob = useJobsApi((state) => state.resumeCronJob);
  const pauseCronJob = useJobsApi((state) => state.pauseCronJob);
  const duplicate = useJobsApi((state) => state.duplicate);
  const triggerScheduledRuns = useJobsApi(
    (state) => state.triggerScheduledRuns
  );
  const fetchPage = useJobRunsApi((state) => state.fetchPage);
  const pageSize = useJobRunsApi((state) => state.pagination?.page_size);

  const pauseJob = React.useCallback(() => {
    if (uuid) pauseCronJob(uuid);
  }, [pauseCronJob, uuid]);

  const resumeJob = React.useCallback(() => {
    if (uuid) resumeCronJob(uuid);
  }, [resumeCronJob, uuid]);

  const cancelJob = React.useCallback(() => {
    if (uuid) cancel(uuid);
  }, [cancel, uuid]);

  const duplicateJob = React.useCallback(async () => {
    if (!uuid) return;
    const duplicatedJob = await duplicate(uuid);
    selectJob(undefined, duplicatedJob.uuid);
  }, [duplicate, selectJob, uuid]);

  const triggerJobNow = React.useCallback(async () => {
    if (!uuid) return;
    await triggerScheduledRuns(uuid);
    fetchPage({ page: 1, pageSize: pageSize || 10 });
  }, [triggerScheduledRuns, uuid, pageSize, fetchPage]);

  return {
    scheduleJob,
    pauseJob,
    resumeJob,
    cancelJob,
    duplicateJob,
    triggerJobNow,
  };
};
