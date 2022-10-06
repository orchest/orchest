import { ErrorSummary } from "@/components/common/ErrorSummary";
import { useGlobalContext } from "@/contexts/GlobalContext";
import { useConfirm } from "@/hooks/useConfirm";
import { AnyAsyncFunction } from "@/types";
import React from "react";

/** Cancels a job run after the user confirms it. */
export const useCancelJobRun = <F extends AnyAsyncFunction>(cancel: F) => {
  const { setAlert } = useGlobalContext();

  return useConfirm(
    () =>
      cancel().catch((error) =>
        setAlert("Failed to cancel job run", <ErrorSummary error={error} />)
      ),
    {
      content: "Are you sure that you want to cancel this Job Run?",
      confirmLabel: "Cancel run",
      cancelLabel: "Close",
      confirmButtonColor: "error",
    }
  );
};
