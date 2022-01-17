import React from "react";

export const useAutoCleanUpEnabled = (
  initialNumberOfRetainedRuns: number,
  selectedRuns: string[]
) => {
  const [isAutoCleanUpEnabled, setIsAutoCleanUpEnabled] = React.useState(false);
  const [numberOfRetainedRuns, setNumberOfRetainedRuns] = React.useState(0);

  const onChangeNumberOfRetainedRuns = (value: number) => {
    // A possible value of 0 might make sense once we keep artifacts such as logs around for users to inspect
    // even if the pipeline run was deleted.
    setNumberOfRetainedRuns(Math.max(value, 1));
  };

  React.useEffect(() => {
    setIsAutoCleanUpEnabled(initialNumberOfRetainedRuns > -1);
    onChangeNumberOfRetainedRuns(initialNumberOfRetainedRuns);
  }, [initialNumberOfRetainedRuns]);

  React.useEffect(() => {
    // if this feature is enabled earlier (i.e. initialNumberOfRetainedRuns > -1), we respect it
    // otherwise, we set the length of the selected runs as the initial value
    if (initialNumberOfRetainedRuns === -1) {
      setNumberOfRetainedRuns(selectedRuns.length);
    }
  }, [initialNumberOfRetainedRuns, selectedRuns.length]);

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
