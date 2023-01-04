import { useProjectJobsApi } from "@/api/jobs/useProjectJobsApi";
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
  const put = useProjectJobsApi((state) => state.put);
  const setJobs = useProjectJobsApi((state) => state.setJobs);
  const jobChanges = useEditJob((state) => state.jobChanges);
  const stopEditing = useEditJob((state) => state.stopEditing);

  const scheduleJob = React.useCallback(async () => {
    const isValid =
      hasValue(jobChanges) &&
      (hasValue(jobChanges.schedule) ||
        hasValue(jobChanges.next_scheduled_time));

    if (!isValid) return;

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
      // If no parameters are given, provide one empty object as a parameterless run.
      const parameters =
        jobChanges.parameters.length === 0 ? [{}] : jobChanges.parameters;
      const jobChangesData: DraftJobData = {
        ...omit(
          jobChanges,
          "project_uuid",
          "pipeline_uuid",
          "status",
          "parameters"
        ),
        parameters,
        confirm_draft: true,
      };
      await put(jobChangesData);
    }
  }, [jobChanges, put, setJobs, stopEditing]);

  return scheduleJob;
};
