import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useEditJob } from "@/jobs-view/stores/useEditJob";
import { JobChanges } from "@/types";
import { hasValue } from "@orchest/lib-utils";
import React from "react";

export const useLoadValueFromJobChanges = <T,>(
  selector: (jobChanges: JobChanges | undefined) => T,
  loadValue: (value: T) => void
) => {
  const selectorRef = React.useRef(selector);
  const loadValueRef = React.useRef(loadValue);
  const { jobUuid } = useCustomRoute();
  const value = useEditJob((state) => selectorRef.current(state.jobChanges));
  const isJobLoaded = useEditJob((state) => {
    const jobChangesUuid = state.jobChanges?.uuid;
    const isEditing = state.isEditing;
    const isEditingInPipelineEditor = !hasValue(jobUuid);
    const hasLoadedJobChanges = jobUuid === jobChangesUuid;

    return (
      isEditing &&
      hasValue(jobChangesUuid) &&
      (isEditingInPipelineEditor || hasLoadedJobChanges)
    );
  });

  const hasLoaded = React.useRef(false);

  React.useLayoutEffect(() => {
    if (!hasLoaded.current && isJobLoaded) {
      hasLoaded.current = true;
      loadValueRef.current(value);
    }
  }, [value, isJobLoaded]);
};
