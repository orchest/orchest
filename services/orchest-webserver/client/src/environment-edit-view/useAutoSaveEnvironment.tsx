import { useAppContext } from "@/contexts/AppContext";
import { useDebounce } from "@/hooks/useDebounce";
import { useHasChanged } from "@/hooks/useHasChanged";
import type { Environment } from "@/types";
import React from "react";
import { shallowEqualByKey } from "./shallowEqualByKey";

export const useAutoSaveEnvironment = (
  value: Environment | null,
  save: (newValue: Environment) => Promise<void>
) => {
  const { setAsSaved } = useAppContext();
  const valuesForSaving = useDebounce(value, 500);
  const shouldSave = useHasChanged(valuesForSaving, (prev, curr) => {
    if (!prev || !curr) return false;
    return !shallowEqualByKey(prev, curr, [
      "base_image",
      "gpu_support",
      "language",
      "name",
      "setup_script",
    ]);
  });

  const doSave = React.useCallback(
    async (newValue: Environment) => {
      await save(newValue);
      setAsSaved();
    },
    [setAsSaved, save]
  );

  React.useEffect(() => {
    if (shouldSave) {
      doSave(valuesForSaving);
    }
  }, [valuesForSaving, shouldSave, doSave]);
};
