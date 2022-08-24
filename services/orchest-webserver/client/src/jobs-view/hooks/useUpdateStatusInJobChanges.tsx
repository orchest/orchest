import { useJobsApi } from "@/api/jobs/useJobsApi";
import React from "react";
import { useEditJob } from "../stores/useEditJob";

/**
 * Watch the status of the job and update jobChanges accordingly.
 * Note: should only be used once in a view.
 */
export const useUpdateStatusInJobChanges = () => {
  const { jobs } = useJobsApi();
  const { jobChanges, setJobChanges } = useEditJob();

  const jobChangesFromStore = React.useMemo(
    () => jobs?.find((env) => env.uuid === jobChanges?.uuid),
    [jobs, jobChanges?.uuid]
  );

  React.useEffect(() => {
    setJobChanges({ status: jobChangesFromStore?.status });
  }, [setJobChanges, jobChangesFromStore?.status]);
};
