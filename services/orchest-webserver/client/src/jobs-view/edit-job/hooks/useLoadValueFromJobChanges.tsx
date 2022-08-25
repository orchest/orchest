import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useEditJob } from "@/jobs-view/stores/useEditJob";
import { JobChanges } from "@/types";
import React from "react";

export const useLoadValueFromJobChanges = (
  loadValue: (jobChanges: JobChanges | undefined) => void
) => {
  const loadValueRef = React.useRef(loadValue);
  const { jobUuid } = useCustomRoute();
  const { jobChanges } = useEditJob();

  const isJobLoaded = jobUuid && jobUuid === jobChanges?.uuid;

  React.useEffect(() => {
    if (isJobLoaded) loadValueRef.current(jobChanges);
  }, [jobChanges, isJobLoaded]);
};
