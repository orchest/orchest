import { shallowEqualByKey } from "@/environments-view/common";
import { useAutoSave } from "@/hooks/useAutoSave";
import type { EnvironmentData } from "@/types";

const isEnvironmentChanged = (prev: EnvironmentData, curr: EnvironmentData) =>
  !shallowEqualByKey(prev, curr, [
    "base_image",
    "gpu_support",
    "language",
    "name",
    "setup_script",
  ]);

export const useAutoSaveEnvironment = (
  value: EnvironmentData | undefined,
  save: (newValue?: EnvironmentData) => void
) => {
  useAutoSave(value, save, (prev, curr) => {
    const isLoadingPage = !prev || !curr;
    if (isLoadingPage) return false;
    const isRedirectingToAnotherEnvironment = prev.uuid !== curr.uuid;
    if (isRedirectingToAnotherEnvironment) return false;
    return isEnvironmentChanged(prev, curr);
  });
};
