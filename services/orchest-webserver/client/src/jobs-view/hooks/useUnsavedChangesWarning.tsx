import { useGlobalContext } from "@/contexts/GlobalContext";
import React from "react";
import { useIsEditingActiveCronJob } from "../job-view/hooks/useIsEditingActiveCronJob";
import { useEditJob } from "../stores/useEditJob";

export const useUnsavedChangesWarning = () => {
  const { setAsSaved } = useGlobalContext();
  const { isEditingActiveCronJob } = useIsEditingActiveCronJob();
  const { setConfirm } = useGlobalContext();
  const hasUnsavedCronJobChanges = useEditJob(
    (state) => state.hasUnsavedCronJobChanges
  );
  const discardActiveCronJobChanges = useEditJob(
    (state) => state.discardActiveCronJobChanges
  );

  const shouldConfirm = isEditingActiveCronJob && hasUnsavedCronJobChanges;

  const withConfirmation = React.useCallback(
    (action: () => Promise<void>) => {
      if (shouldConfirm) {
        // Remove the unsaved changes warning triggered by GlobalContext.
        // and trigger the warning manually.
        setAsSaved(true);
        setConfirm(
          "Warning",
          "There are unsaved changes. Are you sure you want to navigate away?",
          (resolve) => {
            discardActiveCronJobChanges();
            action().then(() => resolve(true));
            return true;
          }
        );
      } else {
        action();
      }
    },
    [shouldConfirm, discardActiveCronJobChanges, setConfirm, setAsSaved]
  );

  return { withConfirmation };
};
