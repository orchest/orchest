import { useProjectJobsApi } from "@/api/jobs/useProjectJobsApi";
import { useAsync } from "@/hooks/useAsync";
import React from "react";

export const useDeleteJob = () => {
  const { run, status } = useAsync();
  const deleteJobRequest = useProjectJobsApi((state) => state.delete);

  const deleteJob = React.useCallback(
    (jobUuid: string) => {
      return run(deleteJobRequest(jobUuid));
    },
    [run, deleteJobRequest]
  );

  return { deleteJob, isDeletingJob: status === "PENDING" };
};
