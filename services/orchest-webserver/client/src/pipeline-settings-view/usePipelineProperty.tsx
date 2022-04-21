import { useAppContext } from "@/contexts/AppContext";
import React from "react";

/**
 * a generic hook that is used to persist mutations of properties of PipelineJson
 */
export function usePipelineProperty<T>({
  initialValue,
  fallbackValue,
}: {
  initialValue: T | undefined;
  fallbackValue?: T;
}) {
  const { setAsSaved } = useAppContext();

  const [pipelineProperty, _setPipelineProperty] = React.useState<
    T | undefined
  >(undefined);

  const isPropertyInitialized = React.useRef(false);

  React.useEffect(() => {
    if (!isPropertyInitialized.current && initialValue) {
      isPropertyInitialized.current = true;
      _setPipelineProperty(initialValue);
    }
  }, [initialValue, _setPipelineProperty]);

  const setPipelineProperty = React.useCallback(
    (value: React.SetStateAction<T | undefined>) => {
      _setPipelineProperty(value);
      setAsSaved(false);
    },
    [_setPipelineProperty, setAsSaved]
  );

  return [pipelineProperty || fallbackValue, setPipelineProperty] as const;
}
