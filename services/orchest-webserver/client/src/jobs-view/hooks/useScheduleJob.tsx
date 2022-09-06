import { useJobsApi } from "@/api/jobs/useJobsApi";
import { DraftJobData, JobStatus } from "@/types";
import { toUtcDateTimeString } from "@/utils/date-time";
import { omit } from "@/utils/record";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useEditJob } from "../stores/useEditJob";

/**
 * Submit a draft job.
 */
export const useScheduleJob = () => {
  const put = useJobsApi((state) => state.put);
  const setJobs = useJobsApi((state) => state.setJobs);
  const jobChanges = useEditJob((state) => state.jobChanges);
  const stopEditing = useEditJob((state) => state.stopEditing);

  const scheduleJob = React.useCallback(async () => {
    const hasSchedule =
      hasValue(jobChanges) &&
      (hasValue(jobChanges.schedule) ||
        hasValue(jobChanges.next_scheduled_time));

    if (!hasSchedule) return;

    stopEditing();

    const isDraftJob = hasValue(jobChanges) && jobChanges.status === "DRAFT";

    const scheduledTimeDiff = jobChanges?.next_scheduled_time
      ? new Date(toUtcDateTimeString(new Date())).getTime() -
        new Date(jobChanges.next_scheduled_time).getTime()
      : 0;

    const shouldStartDraftJobNow =
      isDraftJob && !jobChanges.schedule && scheduledTimeDiff > 0;

    const status: JobStatus = shouldStartDraftJobNow ? "STARTED" : "PENDING";

    setJobs((jobs) => {
      const updatedJobs = (jobs || []).map((job) =>
        job.uuid === jobChanges.uuid ? { ...job, status } : job
      );
      return updatedJobs;
    });

    if (isDraftJob) {
      const jobChangesData: DraftJobData = {
        ...omit(jobChanges, "project_uuid", "pipeline_uuid", "status"),
        confirm_draft: true,
      };
      await put(jobChangesData);
    }
  }, [jobChanges, put, setJobs, stopEditing]);

  return scheduleJob;
};
