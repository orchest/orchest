import { useValidJobQueryArgs } from "@/jobs-view/hooks/useValidJobQueryArgs";
import { useEditJob } from "@/jobs-view/stores/useEditJob";
import { hasValue } from "@orchest/lib-utils";
import React from "react";

export const useAutoCleanUpEnabled = (selectedRuns: string[]) => {
  const { jobUuid } = useValidJobQueryArgs();
  const setJobChanges = useEditJob((state) => state.setJobChanges);

  const initialNumberOfRetainedRuns = useEditJob(
    (state) => state.jobChanges?.max_retained_pipeline_runs
  );

  const [isAutoCleanUpEnabled, setIsAutoCleanUpEnabled] = React.useState(false);
  const [numberOfRetainedRuns, setNumberOfRetainedRuns] = React.useState(0);

  const onChangeNumberOfRetainedRuns = React.useCallback((value: number) => {
    // A possible value of 0 might make sense once we keep artifacts such as logs around for users to inspect
    // even if the pipeline run was deleted.
    setNumberOfRetainedRuns(Math.max(value, 1));
  }, []);

  React.useEffect(() => {
    if (jobUuid) {
      setJobChanges({
        max_retained_pipeline_runs: isAutoCleanUpEnabled
          ? numberOfRetainedRuns
          : -1,
      });
    }
  }, [jobUuid, setJobChanges, numberOfRetainedRuns, isAutoCleanUpEnabled]);

  const hasInitialized = React.useRef(false);
  React.useEffect(() => {
    if (
      jobUuid &&
      hasValue(initialNumberOfRetainedRuns) &&
      !hasInitialized.current
    ) {
      hasInitialized.current = true;
      setIsAutoCleanUpEnabled(initialNumberOfRetainedRuns > -1);
      // Do not update if this feature is enabled earlier (i.e. initialNumberOfRetainedRuns > -1).
      // Otherwise, set the length of the selected runs as the initial value.
      onChangeNumberOfRetainedRuns(
        initialNumberOfRetainedRuns === -1
          ? selectedRuns.length
          : initialNumberOfRetainedRuns
      );
    }
  }, [
    jobUuid,
    initialNumberOfRetainedRuns,
    onChangeNumberOfRetainedRuns,
    selectedRuns,
  ]);

  const toggleIsAutoCleanUpEnabled = () => {
    setIsAutoCleanUpEnabled((current) => !current);
  };

  return {
    isAutoCleanUpEnabled,
    numberOfRetainedRuns,
    onChangeNumberOfRetainedRuns,
    toggleIsAutoCleanUpEnabled,
  };
};
