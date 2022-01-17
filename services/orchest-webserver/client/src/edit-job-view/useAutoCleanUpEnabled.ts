import React from "react";

export const useAutoCleanUpEnabled = (selectedRuns: string[]) => {
  const [isAutoCleanUpEnabled, setIsAutoCleanUpEnabled] = React.useState(false);
  const [numberOfRetainedRuns, setNumberOfRetainedRuns] = React.useState(0);

  const onChangeNumberOfRetainedRuns = (value: number) => {
    // A possible value of 0 might make sense once we keep artifacts such as logs around for users to inspect
    // even if the pipeline run was deleted.
    setNumberOfRetainedRuns(Math.max(value, 1));
  };

  React.useEffect(() => {
    setNumberOfRetainedRuns(selectedRuns.length);
  }, [selectedRuns.length]);

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
