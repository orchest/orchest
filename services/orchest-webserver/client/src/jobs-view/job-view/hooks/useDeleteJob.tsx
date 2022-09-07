import { useJobsApi } from "@/api/jobs/useJobsApi";
import { useAsync } from "@/hooks/useAsync";
import React from "react";

export const useDeleteJob = () => {
  const { run, status } = useAsync();
  const deleteJobRequest = useJobsApi((state) => state.delete);

  const deleteJob = React.useCallback(
    (jobUuid: string) => {
      run(deleteJobRequest(jobUuid));
    },
    [run, deleteJobRequest]
  );

  return { deleteJob, isDeletingJob: status === "PENDING" };
};
