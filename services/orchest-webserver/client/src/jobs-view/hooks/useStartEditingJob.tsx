import React from "react";
import { useEditJobType } from "../job-view/hooks/useEditJobType";
import { useEditJob } from "../stores/useEditJob";

export const useStartEditingJob = () => {
  const editJobType = useEditJobType();
  const startEditing = useEditJob((state) => state.startEditingActiveCronJob);
  const stopEditing = useEditJob((state) => state.stopEditing);

  React.useEffect(() => {
    if (editJobType === "draft") {
      startEditing();
    }
    return () => stopEditing();
  }, [editJobType, startEditing, stopEditing]);

  return { startEditing };
};
