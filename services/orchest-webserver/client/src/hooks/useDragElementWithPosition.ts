import { useDragElement } from "@/hooks/useDragElement";
import { Point2D } from "@/utils/geometry";
import React from "react";

export type ClientPosition = {
  prev: Point2D;
  delta: Point2D;
};

export const useDragElementWithPosition = (
  onDrag: (position: React.MutableRefObject<ClientPosition>) => void,
  onStopDragging?: (event?: MouseEvent) => void
) => {
  const position = React.useRef<ClientPosition>({
    prev: [0, 0],
    delta: [0, 0],
  });

  const onStartDragging = React.useCallback((event: React.MouseEvent) => {
    position.current.prev[0] = event.clientX;
    position.current.delta[0] = 0;
    position.current.prev[1] = event.clientY;
    position.current.delta[1] = 0;
  }, []);

  const onDragging = React.useCallback(
    (event: MouseEvent) => {
      position.current.delta[0] += event.clientX - position.current.prev[0];
      position.current.prev[0] = event.clientX;
      position.current.delta[1] += event.clientY - position.current.prev[1];
      position.current.prev[1] = event.clientY;
      onDrag(position);
      position.current.delta = [0, 0];
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
