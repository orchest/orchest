import { shallowEqualByKey } from "@/environments-view/common";
import { useDebounce } from "@/hooks/useDebounce";
import { useHasChanged } from "@/hooks/useHasChanged";
import type { EnvironmentData } from "@/types";
import React from "react";

const isEnvironmentChanged = (prev: EnvironmentData, curr: EnvironmentData) =>
  !shallowEqualByKey(prev, curr, [
    "base_image",
    "gpu_support",
    "language",
    "name",
    "setup_script",
  ]);

const useHasEnvironmentChanged = (environment: EnvironmentData | undefined) => {
  const hasChanged = useHasChanged(environment, (prev, curr) => {
    const isLoadingPage = !prev || !curr;
    if (isLoadingPage) return false;
    const isRedirectingToAnotherEnvironment = prev.uuid !== curr.uuid;
    if (isRedirectingToAnotherEnvironment) return false;
    return isEnvironmentChanged(prev, curr);
  });
  return hasChanged;
};

export const useAutoSaveEnvironment = (
  value: EnvironmentData | undefined,
  save: (newValue?: EnvironmentData) => void
) => {
  const valuesForSaving = useDebounce(value, 250);
  const shouldSaveDebouncedValue = useHasEnvironmentChanged(valuesForSaving);

  React.useEffect(() => {
    if (shouldSaveDebouncedValue) save();
  }, [shouldSaveDebouncedValue, save]);
};
