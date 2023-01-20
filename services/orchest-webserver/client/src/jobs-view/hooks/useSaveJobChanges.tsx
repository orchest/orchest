import { useProjectJobsApi } from "@/api/jobs/useProjectJobsApi";
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
  const put = useProjectJobsApi((state) => state.put);
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

      const putPayload = hasValue(jobChangesData.schedule)
        ? omit(jobChangesData, "next_scheduled_time")
        : jobChangesData;

      put(putPayload);
    }
  }, [jobChanges, put]);

  useAutoSaveJob(jobChanges, save);
};
