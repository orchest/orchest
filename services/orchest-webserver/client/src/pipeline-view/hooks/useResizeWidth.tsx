import { useDragElement } from "@/hooks/useDragElement";
import React from "react";

export type PositionX = {
  prev: number;
  delta: number;
};

export const useResizeWidth = (
  onDrag: (
    positionX: React.MutableRefObject<{ prev: number; delta: number }>
  ) => void,
  onStopDragging?: (e?: MouseEvent) => void
) => {
  const positionX = React.useRef<PositionX>({
    prev: 0,
    delta: 0,
  });

  const onStartDragging = React.useCallback((e: React.MouseEvent) => {
    positionX.current.prev = e.clientX;
    positionX.current.delta = 0;
  }, []);

  const onDragging = React.useCallback(
    (e: MouseEvent) => {
      positionX.current.delta += e.clientX - positionX.current.prev;
      positionX.current.prev = e.clientX;
      onDrag(positionX);
    },
    [onDrag]
  );

  const startDragging = useDragElement({
    onStartDragging,
    onDragging,
    onStopDragging,
  });

  return startDragging;
};
