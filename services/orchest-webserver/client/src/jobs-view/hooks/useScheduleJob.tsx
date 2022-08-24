import { useJobsApi } from "@/api/jobs/useJobsApi";
import { DraftJobData } from "@/types";
import { omit } from "@/utils/record";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useEditJob } from "../stores/useEditJob";

/**
 * Submit a draft job.
 */
export const useScheduleJob = () => {
  const { put } = useJobsApi();
  const { jobChanges } = useEditJob();

  const scheduleJob = React.useCallback(async () => {
    const isDraftJob = hasValue(jobChanges) && jobChanges.status === "DRAFT";

    if (isDraftJob) {
      const jobChangesData: DraftJobData = {
        ...omit(jobChanges, "project_uuid", "pipeline_uuid", "status"),
        confirm_draft: true,
      };
      await put(jobChangesData);
    }
  }, [jobChanges, put]);

  return scheduleJob;
};
