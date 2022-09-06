import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useEditJob } from "@/jobs-view/stores/useEditJob";
import { JobChanges } from "@/types";
import React from "react";

export const useLoadValueFromJobChanges = <T,>(
  selector: (jobChanges: JobChanges | undefined) => T,
  loadValue: (value: T) => void
) => {
  const selectorRef = React.useRef(selector);
  const loadValueRef = React.useRef(loadValue);
  const { jobUuid } = useCustomRoute();
  const value = useEditJob((state) => selectorRef.current(state.jobChanges));
  const isJobLoaded = useEditJob(
    (state) => jobUuid && jobUuid === state.jobChanges?.uuid
  );

  const hasLoaded = React.useRef(false);

  React.useEffect(() => {
    if (!hasLoaded.current && isJobLoaded) {
      hasLoaded.current = true;
      loadValueRef.current(value);
    }
  }, [value, isJobLoaded]);
};
