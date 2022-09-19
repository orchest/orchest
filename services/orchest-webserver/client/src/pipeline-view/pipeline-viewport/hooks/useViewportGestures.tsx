import { Point2D, subtractPoints } from "@/utils/geometry";
import { createUseGesture, pinchAction, wheelAction } from "@use-gesture/react";
import React from "react";
import { useCanvasScaling } from "../../contexts/CanvasScalingContext";
import { usePipelineDataContext } from "../../contexts/PipelineDataContext";
import { PipelineCanvasState } from "../../hooks/usePipelineCanvasState";

const ZOOM_SCROLL_FACTOR = 0.25;

const useGesture = createUseGesture([wheelAction, pinchAction]);

/**
 * This hook is responsible for panning and zooming the viewport using
 * either gestures on a touch pad (pinching, two-finger panning),
 * or by using a mouse with a scroll wheel.
 */
export const useViewportGestures = (
  setPipelineCanvasState: React.Dispatch<
    | Partial<PipelineCanvasState>
    | ((current: PipelineCanvasState) => Partial<PipelineCanvasState>)
  >,
  ref: React.MutableRefObject<HTMLDivElement | null>,
  setPipelineCanvasOrigin: (origin: Point2D) => void
) => {
  const { disabled } = usePipelineDataContext();
  const { setScaleFactor, windowToCanvasPoint } = useCanvasScaling();

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

      const relativeOrigin = windowToCanvasPoint(origin);

      setPipelineCanvasOrigin(relativeOrigin);
      setScaleFactor((current) => current + delta);
    },
    [disabled, setPipelineCanvasOrigin, setScaleFactor, windowToCanvasPoint]
  );

  useGesture(
    {
      onWheel: ({ pinching, wheeling, delta }) => {
        if (disabled || pinching || !wheeling) return;

        setPipelineCanvasState((current) => ({
          pipelineOffset: subtractPoints(current.pipelineOffset, delta),
        }));
      },
      onPinch: ({ pinching, offset: [offset], event }) => {
        if (disabled || !pinching) return;
        const { clientX, clientY } = event as WheelEvent | PointerEvent;

        const originOnCanvas = windowToCanvasPoint([clientX, clientY]);
        setPipelineCanvasOrigin(originOnCanvas);

        if (event instanceof WheelEvent) {
          const wheelDelta = (event.deltaY * ZOOM_SCROLL_FACTOR) / 100;

          setScaleFactor((current) => current - wheelDelta);
        } else {
          setScaleFactor(offset);
        }
      },
    },
    {
      target: ref,
      eventOptions: { passive: false, capture: true, preventDefault: true },
    }
  );

  return zoomBy;
};
