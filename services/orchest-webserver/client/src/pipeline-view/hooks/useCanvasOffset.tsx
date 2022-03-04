import { useHasChanged } from "@/hooks/useHasChanged";
import { getOffset } from "@/utils/jquery-replacement";
import React from "react";

/**
 * a hook that memoize canvas offset
 */
export const useCanvasOffset = (
  pipelineCanvasRef: React.MutableRefObject<HTMLDivElement>
) => {
  const realTimeCanvasOffset = getOffset(pipelineCanvasRef.current);
  const shouldUpdateCanvasOffset = useHasChanged(
    realTimeCanvasOffset,
    (prev, curr) => !prev || prev.left !== curr.left || prev.top !== curr.top
  );
  const canvasOffset = React.useMemo(() => {
    return realTimeCanvasOffset;
  }, [shouldUpdateCanvasOffset]); // eslint-disable-line react-hooks/exhaustive-deps
  return canvasOffset;
};
