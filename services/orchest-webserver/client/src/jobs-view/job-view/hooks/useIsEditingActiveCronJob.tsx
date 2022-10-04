import { getEditJobType, useEditJob } from "@/jobs-view/stores/useEditJob";

export const useIsEditingActiveCronJob = () => {
  const isEditingActiveCronJob = useEditJob(
    (state) =>
      getEditJobType(state.jobChanges) === "active-cronjob" && state.isEditing
  );

  return { isEditingActiveCronJob };
};
