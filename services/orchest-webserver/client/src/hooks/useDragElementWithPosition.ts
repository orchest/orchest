import { useDragElement } from "@/hooks/useDragElement";
import { Position } from "@/types";
import React from "react";

export type ClientPosition = {
  prev: Position;
  delta: Position;
};

export const useDragElementWithPosition = (
  onDrag: (
    position: React.MutableRefObject<{ prev: Position; delta: Position }>
  ) => void,
  onStopDragging?: (e?: MouseEvent) => void
) => {
  const position = React.useRef<ClientPosition>({
    prev: { x: 0, y: 0 },
    delta: { x: 0, y: 0 },
  });

  const onStartDragging = React.useCallback((e: React.MouseEvent) => {
    position.current.prev.x = e.clientX;
    position.current.delta.x = 0;
    position.current.prev.y = e.clientY;
    position.current.delta.y = 0;
  }, []);

  const onDragging = React.useCallback(
    (e: MouseEvent) => {
      position.current.delta.x += e.clientX - position.current.prev.x;
      position.current.prev.x = e.clientX;
      position.current.delta.y += e.clientY - position.current.prev.y;
      position.current.prev.y = e.clientY;
      onDrag(position);
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
