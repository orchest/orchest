import { useJobsApi } from "@/api/jobs/useJobsApi";
import { JobChangesData } from "@/types";
import { omit } from "@/utils/record";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useEditJob } from "../stores/useEditJob";
import { useAutoSaveJob } from "./useAutoSaveJob";

/**
 * Watch the changes of the changes of a draft job or a cron job and save it to BE in the background. The value is debounced.
 * Note: should only be used once in a view.
 */
export const useSaveJobChanges = () => {
  const put = useJobsApi((state) => state.put);
  const jobChanges = useEditJob((state) => state.jobChanges);

  const save = React.useCallback(() => {
    const isDraft = jobChanges?.status === "DRAFT";
    const isCronJob = hasValue(jobChanges?.schedule);

    const isAllowedToEdit = hasValue(jobChanges) && (isDraft || isCronJob);

    if (isAllowedToEdit) {
      const jobChangesData: JobChangesData = omit(
        jobChanges,
        "project_uuid",
        "pipeline_uuid",
        "status",
        "confirm_draft"
      );
      put(jobChangesData);
    }
  }, [jobChanges, put]);

  useAutoSaveJob(jobChanges, save);
};
