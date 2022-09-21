import { useGlobalContext } from "@/contexts/GlobalContext";
import React from "react";

type UsePipelinePropertyParams<T> = {
  initialValue: T | undefined;
  hash: string;
};

/**
 * A React.useState hook that allows re-initialization by changing `hash`.
 */
export function usePipelineProperty<T>({
  initialValue,
  hash,
}: UsePipelinePropertyParams<T>) {
  const { setAsSaved } = useGlobalContext();

  const [pipelineProperty, localSetPipelineProperty] = React.useState<
    T | undefined
  >(undefined);

  const localHash = React.useRef<string>("");

  // Only re-initialize the value if hash is changed
  React.useEffect(() => {
    if (initialValue && localHash.current !== hash) {
      localHash.current = hash;
      localSetPipelineProperty(initialValue);
    }
  }, [initialValue, hash, localSetPipelineProperty]);

  const setPipelineProperty = React.useCallback(
    (value: React.SetStateAction<T | undefined>) => {
      localSetPipelineProperty(value);
      setAsSaved(false);
    },
    [localSetPipelineProperty, setAsSaved]
  );

  return [pipelineProperty, setPipelineProperty] as const;
}
