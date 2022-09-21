import { useJobRunsApi } from "@/api/job-runs/useJobRunsApi";
import { useConfirm } from "@/hooks/useConfirm";

/** Cancels a job run after the user confirms it. */
export const useCancelJobRun = () => {
  const cancel = useJobRunsApi((api) => api.cancel);

  return useConfirm(cancel, {
    content: "Are you sure that you want to cancel this Job Run?",
    confirmLabel: "Cancel run",
    cancelLabel: "Close",
    confirmButtonColor: "error",
  });
};
