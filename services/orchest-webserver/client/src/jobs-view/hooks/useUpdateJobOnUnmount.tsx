import { useJobsApi } from "@/api/jobs/useJobsApi";
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
    if (jobChangesRef.current) {
      setJobs((jobs) => {
        const updatedJobs = jobs.map((job) =>
          job.uuid === jobChangesRef.current?.uuid
            ? { ...job, ...jobChangesRef.current }
            : job
        );
        return updatedJobs;
      });
      resetJobChanges();
    }
  }, [setJobs, resetJobChanges]);

  React.useEffect(() => {
    return () => updateJob();
  }, [updateJob]);
};
