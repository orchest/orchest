import { useJobsApi } from "@/api/jobs/useJobsApi";
import { omit } from "@/utils/record";
import React from "react";
import { useEditJob } from "../stores/useEditJob";

/**
 * Update useJobsApi with jobChanges on unmount.
 * To keep useJobsApi updated when user leaves the job editing view.
 */
export const useUpdateJobOnUnmount = () => {
  const setJobs = useJobsApi((state) => state.setJobs);
  const resetJobChanges = useEditJob((state) => state.resetJobChanges);

  const jobChangesRef = React.useRef(useEditJob.getState().jobChanges);

  React.useEffect(
    () =>
      useEditJob.subscribe(
        (state) => (jobChangesRef.current = state.jobChanges)
      ),
    []
  );

  const updateJob = React.useCallback(() => {
    setJobs((jobs) => {
      const updatedJobs = jobs.map((job) =>
        job.uuid === jobChangesRef.current?.uuid
          ? {
              ...job,
              ...omit(
                jobChangesRef.current,
                "loadedStrategyFilePath",
                "confirm_draft"
              ),
            }
          : job
      );
      return updatedJobs;
    });
  }, [setJobs]);

  const updateJobAndReset = React.useCallback(() => {
    if (jobChangesRef.current) {
      updateJob();
      resetJobChanges();
    }
  }, [updateJob, resetJobChanges]);

  React.useEffect(() => {
    return () => updateJobAndReset();
  }, [updateJobAndReset]);

  return { updateJobAndReset };
};
