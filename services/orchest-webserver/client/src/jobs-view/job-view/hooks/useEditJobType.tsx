import { useEditJob } from "@/jobs-view/stores/useEditJob";
import { hasValue } from "@orchest/lib-utils";

export type EditJobType = "draft" | "active-cronjob" | "uneditable";

export const useEditJobType = () => {
  const editJobType = useEditJob((state) => {
    const isDraft = state.jobChanges?.status === "DRAFT";
    if (isDraft) return "draft";

    const jobFinished =
      state.jobChanges?.status === "ABORTED" ||
      state.jobChanges?.status === "FAILURE" ||
      state.jobChanges?.status === "SUCCESS";

    if (jobFinished) return "uneditable";

    const isActiveCronJob =
      !jobFinished && !isDraft && hasValue(state.jobChanges?.schedule);

    if (isActiveCronJob) return "active-cronjob";

    return "uneditable";
  });

  return editJobType;
};
