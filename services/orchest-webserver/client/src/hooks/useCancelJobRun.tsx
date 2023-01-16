import { useJobRunsApi } from "@/api/job-runs/useJobRunsApi";
import { ErrorSummary } from "@/components/common/ErrorSummary";
import { useGlobalContext } from "@/contexts/GlobalContext";
import { useConfirm } from "@/hooks/useConfirm";
import React from "react";

/** Cancels a job run after the user confirms it. */
export const useCancelJobRun = () => {
  const { setAlert } = useGlobalContext();
  const cancelJob = useJobRunsApi((api) => api.cancel);

  return useConfirm(
    (jobUuid: string, runUuid: string) => {
      cancelJob(jobUuid, runUuid).catch((error) =>
        setAlert("Failed to cancel job run", <ErrorSummary error={error} />)
      );
    },
    {
      content: "Are you sure that you want to cancel this Job Run?",
      confirmLabel: "Cancel run",
      cancelLabel: "Close",
      confirmButtonColor: "error",
    }
  );
};
