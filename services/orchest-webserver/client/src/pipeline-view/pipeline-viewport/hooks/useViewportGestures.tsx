import { centroid, Point2D, subtractPoints } from "@/utils/geometry";
import { hasValue } from "@orchest/lib-utils";
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
      onWheel: ({ event, last }) => {
        if (disabled || last) return;

        // NOTE:
        //  While the pinch handler may also handle CTRL/META + scroll
        //  for zooming actions, it causes both of these handlers to
        //  trigger at the same time, and it causes jankiness.
        //  So we let this handler handle all wheel events!

        if (isZooming(event)) {
          const { deltaY, clientX, clientY } = event;
          const wheelDelta = (deltaY * ZOOM_SCROLL_FACTOR) / 100;
          const originOnCanvas = windowToCanvasPoint([clientX, clientY]);

          setPipelineCanvasOrigin(originOnCanvas);
          setScaleFactor((current) => current - wheelDelta);
        } else {
          const delta: Point2D = isScrollAxisSwapped(event)
            ? [event.deltaY, event.deltaX]
            : [event.deltaX, event.deltaY];

          setPipelineCanvasState((current) => ({
            pipelineOffset: subtractPoints(current.pipelineOffset, delta),
          }));
        }
      },
      onPinch: ({ offset: [offset], event }) => {
        if (disabled || event instanceof WheelEvent) return;

        const center = getClientCenter(event);

        if (hasValue(center)) {
          setPipelineCanvasOrigin(windowToCanvasPoint(center));
        }

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

/** Holding Ctrl (or Command on Mac) triggers zooming. */
const isZooming = (event: WheelEvent) => event.ctrlKey || event.metaKey;

/**
 * Holding Shift swaps X and Y axises when scrolling,
 * so you can scroll horizontally even if you have a mouse without a horizontal scroll wheel.
 */
const isScrollAxisSwapped = (event: WheelEvent) => event.shiftKey;

const getClientCenter = (
  event: PointerEvent | TouchEvent
): Point2D | undefined => {
  if ("clientX" in event && "clientY" in event) {
    return [event.clientX, event.clientY];
  } else if (event instanceof TouchEvent && event.touches.length > 0) {
    return centroid(
      [...event.touches].map(({ clientX, clientY }) => [clientX, clientY])
    );
  } else {
    return undefined;
  }
};
