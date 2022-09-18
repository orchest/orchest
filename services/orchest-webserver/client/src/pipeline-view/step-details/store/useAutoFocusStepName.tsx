import React from "react";
import create from "zustand";

export type SnapshotsApi = {
  shouldAutoFocusStepName: boolean;
  setShouldAutoFocusStepName: (value: boolean) => void;
};

const useShouldAutoFocusStepName = create<SnapshotsApi>((set) => {
  return {
    shouldAutoFocusStepName: false,
    setShouldAutoFocusStepName: (value) =>
      set({ shouldAutoFocusStepName: value }),
  };
});

export const useSetShouldAutoFocusStepName = () => {
  const setShouldAutoFocusStepName = useShouldAutoFocusStepName(
    (state) => state.setShouldAutoFocusStepName
  );
  return { setShouldAutoFocusStepName };
};

/**
 * Step name field in StepDetails should be auto-focused ONLY when creating a new step.
 * Otherwise, deleting a step becomes cumbersome, that is, user needs to
 * 1. Click the step
 * 2. Click somewhere in StepDetails, to remove the focus on the Step Name field.
 * 3. Press "Delete" to delete the step.
 * Normally, we would autofocus the first field in a form to enhance UX, but not for this specific case.
 * Pulling this state out to its own store, so that  we won't accidentally change it back to always auto-focus.
 */
export const useAutoFocusStepName = () => {
  const shouldAutoFocusStepName = useShouldAutoFocusStepName(
    (state) => state.shouldAutoFocusStepName
  );
  const setShouldAutoFocusStepName = useShouldAutoFocusStepName(
    (state) => state.setShouldAutoFocusStepName
  );
  React.useEffect(() => () => setShouldAutoFocusStepName(false), [
    setShouldAutoFocusStepName,
  ]);
  return { shouldAutoFocusStepName };
};
