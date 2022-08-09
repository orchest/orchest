import { Point2D } from "@/types";
import { getOffset } from "@/utils/jquery-replacement";
import { createUseGesture, pinchAction, wheelAction } from "@use-gesture/react";
import React from "react";
import { scaleCorrected } from "../../common";
import { usePipelineDataContext } from "../../contexts/PipelineDataContext";
import { usePipelineRefs } from "../../contexts/PipelineRefsContext";
import { useScaleFactor } from "../../contexts/ScaleFactorContext";
import { PipelineCanvasState } from "../../hooks/usePipelineCanvasState";

const useGesture = createUseGesture([wheelAction, pinchAction]);

const isTouchPadEvent = (event: WheelEvent) => {
  // deltaMode represents the unit of the delta values scroll amount
  // 0: pixel; 1: line; 2: page
  if (!event.wheelDeltaY && event.deltaMode === 0) return true;
  // see explanation here https://stackoverflow.com/a/62415754
  if (event.wheelDeltaY && event.wheelDeltaY === event.deltaY * -3) return true;

  return false;
};

/**
 * This hook is responsible for pinching and panning on PipelineCanvas
 *
 * It seems that useGesture in one place will intercept all gesture events.
 * So, for example, useWheel in other places in the same view would not work.
 * All the gesture events for PipelineEditor should be implemented in this hook.
 */
export const useGestureOnViewport = (
  setPipelineCanvasState: React.Dispatch<
    | Partial<PipelineCanvasState>
    | ((current: PipelineCanvasState) => Partial<PipelineCanvasState>)
  >,
  ref: React.MutableRefObject<HTMLDivElement | null>,
  pipelineSetHolderOrigin: (newOrigin: Point2D) => void
) => {
  const { disabled } = usePipelineDataContext();
  const { scaleFactor, setScaleFactor, trackMouseMovement } = useScaleFactor();
  const { pipelineCanvasRef } = usePipelineRefs();

  const getPositionRelativeToCanvas = React.useCallback(
    ([x, y]: Point2D): Point2D => {
      trackMouseMovement(x, y); // in case that user start zoom-in/out before moving their cursor
      const canvasOffset = getOffset(pipelineCanvasRef.current);

      return [
        scaleCorrected(x - canvasOffset.left, scaleFactor),
        scaleCorrected(y - canvasOffset.top, scaleFactor),
      ];
    },
    [pipelineCanvasRef, scaleFactor, trackMouseMovement]
  );

  React.useEffect(() => {
    const preventDefault = (event: Event) => event.preventDefault();

    document.addEventListener("gesturestart", preventDefault);
    document.addEventListener("gesturechange", preventDefault);
    document.addEventListener("gestureend", preventDefault);

    return () => {
      document.removeEventListener("gesturestart", preventDefault);
      document.removeEventListener("gesturechange", preventDefault);
      document.removeEventListener("gestureend", preventDefault);
    };
  }, []);

  const zoomBy = React.useCallback(
    (origin: Point2D, delta: number) => {
      if (disabled) return;

      const relativeOrigin = getPositionRelativeToCanvas(origin);

      pipelineSetHolderOrigin(relativeOrigin);
      setScaleFactor((current) => current + delta);
    },
    [
      disabled,
      setScaleFactor,
      getPositionRelativeToCanvas,
      pipelineSetHolderOrigin,
    ]
  );

  useGesture(
    {
      onWheel: ({
        pinching,
        first,
        wheeling,
        delta: [deltaX, deltaY],
        event,
      }) => {
        if (disabled || pinching || !wheeling) return;

        // mouse wheel
        // Weird behavior: `!isTouchpad(event)` is true whenever the pinching direction changes
        // Exclude it when `first` is true.
        if (!first && !isTouchPadEvent(event)) {
          zoomBy([event.clientX, event.clientY], -deltaY / 2048);
          return;
        }

        // Touchpad: panning
        setPipelineCanvasState((current) => ({
          pipelineOffset: [
            current.pipelineOffset[0] - deltaX,
            current.pipelineOffset[1] - deltaY,
          ],
        }));
      },
      onPinch: ({ pinching, offset: [offset], event }) => {
        if (disabled || !pinching) return;

        const { clientX, clientY } = event as PointerEvent;
        const relativeOrigin = getPositionRelativeToCanvas([clientX, clientY]);

        pipelineSetHolderOrigin(relativeOrigin);
        setScaleFactor(offset);
      },
    },
    {
      target: ref,
      eventOptions: { passive: false, capture: true, preventDefault: true },
    }
  );

  return zoomBy;
};
