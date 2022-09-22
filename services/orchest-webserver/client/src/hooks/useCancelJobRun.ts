import { useConfirm } from "@/hooks/useConfirm";
import { AnyAsyncFunction } from "@/types";

/** Cancels a job run after the user confirms it. */
export const useCancelJobRun = <F extends AnyAsyncFunction>(cancel: F) => {
  return useConfirm(cancel, {
    content: "Are you sure that you want to cancel this Job Run?",
    confirmLabel: "Cancel run",
    cancelLabel: "Close",
    confirmButtonColor: "error",
  });
};
