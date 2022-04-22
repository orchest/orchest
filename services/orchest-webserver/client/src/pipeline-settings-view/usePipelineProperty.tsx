import { useAppContext } from "@/contexts/AppContext";
import React from "react";

/**
 * a generic hook that is used to persist mutations of properties of PipelineJson
 */
export function usePipelineProperty<T>({
  initialValue,
  updateHash,
}: {
  initialValue: T | undefined;
  updateHash: string;
}) {
  const { setAsSaved } = useAppContext();

  const [pipelineProperty, _setPipelineProperty] = React.useState<
    T | undefined
  >(undefined);

  const localHash = React.useRef<string>("");

  // Only re-initialize the value if hash is changed
  React.useEffect(() => {
    if (initialValue && localHash.current !== updateHash) {
      localHash.current = updateHash;
      _setPipelineProperty(initialValue);
    }
  }, [initialValue, updateHash, _setPipelineProperty]);

  const setPipelineProperty = React.useCallback(
    (value: React.SetStateAction<T | undefined>) => {
      _setPipelineProperty(value);
      setAsSaved(false);
    },
    [_setPipelineProperty, setAsSaved]
  );

  return [pipelineProperty, setPipelineProperty] as const;
}
