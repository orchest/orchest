import { useJobsApi } from "@/api/jobs/useJobsApi";
import { DraftJobData, JobStatus } from "@/types";
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

  const scheduleJob = React.useCallback(async () => {
    if (!jobChanges) return;
    const isDraftJob = hasValue(jobChanges) && jobChanges.status === "DRAFT";

    const shouldStartDraftJobNow =
      isDraftJob && !jobChanges.schedule && !jobChanges.next_scheduled_time;

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
  }, [jobChanges, put, setJobs]);

  return scheduleJob;
};
