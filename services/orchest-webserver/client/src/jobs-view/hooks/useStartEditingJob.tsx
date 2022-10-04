import { useGlobalContext } from "@/contexts/GlobalContext";
import React from "react";
import { useEditJobType } from "../job-view/hooks/useEditJobType";
import { useEditJob } from "../stores/useEditJob";

export const useStartEditingJob = () => {
  const { setAsSaved } = useGlobalContext();

  const editJobType = useEditJobType();
  const startEditing = useEditJob((state) => state.startEditing);
  const stopEditing = useEditJob((state) => state.stopEditing);

  const startEditingActiveCronJob = React.useCallback(() => {
    startEditing();
    // Prevent user navigating away with the navigation top-bar.
    setAsSaved(false);
  }, [startEditing, setAsSaved]);

  React.useEffect(() => {
    if (editJobType === "draft") {
      startEditing();
    }
    return () => stopEditing();
  }, [editJobType, startEditing, stopEditing]);

  return { startEditingActiveCronJob };
};
