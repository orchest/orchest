import { useAppContext } from "@/contexts/AppContext";
import React from "react";

/**
 * a generic hook that is used to persist mutations of properties of PipelineJson
 */
export function usePipelineProperty<T>(initialValue: T, fallbackValue?: T) {
  const { setAsSaved } = useAppContext();

  const [pipelineProperty, _setPipelineProperty] = React.useState<T>(undefined);
  const isNameInitialized = React.useRef(false);

  React.useEffect(() => {
    if (!isNameInitialized.current && initialValue) {
      isNameInitialized.current = true;
      _setPipelineProperty(initialValue);
    }
  }, [initialValue, _setPipelineProperty]);

  const setPipelineProperty = React.useCallback(
    (value: React.SetStateAction<T>) => {
      _setPipelineProperty(value);
      setAsSaved(false);
    },
    [_setPipelineProperty, setAsSaved]
  );

  return [pipelineProperty || fallbackValue, setPipelineProperty] as const;
}
