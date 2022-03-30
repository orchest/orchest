import { getOffset } from "@/utils/jquery-replacement";
import { createUseGesture, pinchAction, wheelAction } from "@use-gesture/react";
import React from "react";
import { scaleCorrected } from "../common";
import { usePipelineCanvasContext } from "../contexts/PipelineCanvasContext";
import { usePipelineEditorContext } from "../contexts/PipelineEditorContext";

const useGesture = createUseGesture([wheelAction, pinchAction]);

/**
 * This hook is responsible for pinching and panning on PiplineCanvas
 *
 * It seems that useGesture in one place will intercept all gesture events.
 * So, for example, useWheel in other places in the same view would not work.
 * All the gesture events for PipelineEditor should be implemented in this hook.
 */
export const useGestureOnViewport = (
  ref: React.MutableRefObject<HTMLDivElement>,
  pipelineSetHolderOrigin: (newOrigin: [number, number]) => void
) => {
  const {
    eventVars,
    trackMouseMovement,
    dispatch,
    pipelineCanvasRef,
  } = usePipelineEditorContext();

  const {
    pipelineCanvasState: { pipelineOrigin },
    setPipelineCanvasState,
  } = usePipelineCanvasContext();

  const getPositionRelativeToCanvas = React.useCallback(
    ([x, y]: [number, number]) => {
      trackMouseMovement(x, y); // in case that user start zoom-in/out before moving their cursor
      let canvasOffset = getOffset(pipelineCanvasRef.current);

      return [
        scaleCorrected(x - canvasOffset.left, eventVars.scaleFactor),
        scaleCorrected(y - canvasOffset.top, eventVars.scaleFactor),
      ] as [number, number];
    },
    [pipelineCanvasRef, eventVars.scaleFactor, trackMouseMovement]
  );

  const getMousePositionRelativeToCanvas = React.useCallback(
    (e: WheelEvent | React.WheelEvent) => {
      return getPositionRelativeToCanvas([e.clientX, e.clientY]);
    },
    [getPositionRelativeToCanvas]
  );

  React.useEffect(() => {
    const handler = (e: Event) => e.preventDefault();
    document.addEventListener("gesturestart", handler);
    document.addEventListener("gesturechange", handler);
    document.addEventListener("gestureend", handler);
    return () => {
      document.removeEventListener("gesturestart", handler);
      document.removeEventListener("gesturechange", handler);
      document.removeEventListener("gestureend", handler);
    };
  }, []);

  const zoom = React.useCallback(
    (event: WheelEvent | PointerEvent | TouchEvent, scaleDiff: number) => {
      let pipelineMousePosition = getMousePositionRelativeToCanvas(
        event as WheelEvent
      );

      // set origin at scroll wheel trigger
      if (
        pipelineMousePosition[0] !== pipelineOrigin[0] ||
        pipelineMousePosition[1] !== pipelineOrigin[1]
      ) {
        pipelineSetHolderOrigin(pipelineMousePosition);
      }

      dispatch((current) => {
        return {
          type: "SET_SCALE_FACTOR",
          payload: current.scaleFactor + scaleDiff,
        };
      });
    },
    [
      dispatch,
      getMousePositionRelativeToCanvas,
      pipelineOrigin,
      pipelineSetHolderOrigin,
    ]
  );

  useGesture(
    {
      onWheel: ({ pinching, wheeling, delta: [dx, dy] }) => {
        if (pinching || !wheeling) return;

        setPipelineCanvasState((current) => ({
          pipelineOffset: [
            current.pipelineOffset[0] - dx,
            current.pipelineOffset[1] - dy,
          ],
        }));
      },
      onPinch: ({ pinching, delta, event }) => {
        if (!pinching) return;
        zoom(event, delta[0] / 12);
      },
    },
    {
      target: ref,
      preventDefault: true,
      eventOptions: { passive: false, capture: true },
    }
  );
};
