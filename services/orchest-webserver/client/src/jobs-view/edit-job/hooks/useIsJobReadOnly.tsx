import { useEditJob } from "@/jobs-view/stores/useEditJob";
import { hasValue } from "@orchest/lib-utils";

export const useIsJobReadOnly = () => {
  const isReadOnly = useEditJob((state) => {
    const jobFinished =
      state.jobChanges?.status === "ABORTED" ||
      state.jobChanges?.status === "FAILURE" ||
      state.jobChanges?.status === "SUCCESS";

    const isDraft = state.jobChanges?.status === "DRAFT";
    const isActiveCronJob =
      !jobFinished && !isDraft && hasValue(state.jobChanges?.schedule);
    const isEditable = isDraft || isActiveCronJob;

    return !isEditable;
  });

  return { isReadOnly };
};
