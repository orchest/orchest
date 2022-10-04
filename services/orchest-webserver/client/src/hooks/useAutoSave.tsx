import { useDebounce } from "@/hooks/useDebounce";
import { useHasChanged } from "@/hooks/useHasChanged";
import React from "react";

export function useAutoSave<T>(
  value: T,
  save: () => void,
  predicate: (prev: T | undefined, curr: T) => boolean
) {
  const predicateRef = React.useRef(predicate);
  const valuesForSaving = useDebounce(value, 250);
  const shouldSaveDebouncedValue = useHasChanged(
    valuesForSaving,
    predicateRef.current
  );

  React.useEffect(() => {
    if (shouldSaveDebouncedValue) save();
  }, [shouldSaveDebouncedValue, save]);
}
