import { useDebounce } from "@/hooks/useDebounce";
import { useHasChanged } from "@/hooks/useHasChanged";
import type { Environment } from "@/types";
import React from "react";
import { shallowEqualByKey } from "./shallowEqualByKey";

const isEnvironmentChanged = (prev: Environment, curr: Environment) =>
  !shallowEqualByKey(prev, curr, [
    "base_image",
    "gpu_support",
    "language",
    "name",
    "setup_script",
  ]);

const useHasEnvironmentChanged = (environment: Environment | undefined) => {
  const hasChanged = useHasChanged(environment, (prev, curr) => {
    if (!prev || !curr) return false;
    return isEnvironmentChanged(prev, curr);
  });
  return hasChanged;
};

export const useAutoSaveEnvironment = (
  value: Environment | undefined,
  save: (newValue?: Environment) => Promise<Environment | null>
) => {
  const valuesForSaving = useDebounce(value, 500);
  const shouldSave = useHasEnvironmentChanged(valuesForSaving);

  React.useEffect(() => {
    if (shouldSave) save();
  }, [shouldSave, save]);
};
