import React from "react";

export const useAutoCleanUpEnabled = (selectedRuns: string[]) => {
  const [isAutoCleanUpEnabled, setIsAutoCleanUpEnabled] = React.useState(false);
  const [numberOfRetainedRuns, setNumberOfRetainedRuns] = React.useState(0);

  const onChangeNumberOfRetainedRuns = (value: number) => {
    setNumberOfRetainedRuns(Math.max(value, 0));
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
