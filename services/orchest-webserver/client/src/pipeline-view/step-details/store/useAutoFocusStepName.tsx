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
