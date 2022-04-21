import { useAppContext } from "@/contexts/AppContext";
import React from "react";

/**
 * a generic hook that is used to persist mutations of properties of PipelineJson
 */
export function usePipelineProperty<T>(
  initialValue: T | undefined,
  fallbackValue?: T
) {
  const { setAsSaved } = useAppContext();

  const [pipelineProperty, _setPipelineProperty] = React.useState<
    T | undefined
  >(undefined);

  // Re-initialize the value if given `initialValue` is changed.
  // This is because initialValue might be cached by SWR, and real value comes in
  // after the first render.
  // Apply `JSON.stringify` in case that the value is a new Object.
  React.useEffect(() => {
    _setPipelineProperty(initialValue);
  }, [JSON.stringify(initialValue), _setPipelineProperty]); // eslint-disable-line react-hooks/exhaustive-deps

  const setPipelineProperty = React.useCallback(
    (value: React.SetStateAction<T | undefined>) => {
      _setPipelineProperty(value);
      setAsSaved(false);
    },
    [_setPipelineProperty, setAsSaved]
  );

  return [pipelineProperty || fallbackValue, setPipelineProperty] as const;
}
