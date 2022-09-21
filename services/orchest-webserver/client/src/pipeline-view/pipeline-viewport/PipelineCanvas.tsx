import { useCanvasScaling } from "@/pipeline-view/contexts/CanvasScalingContext";
import React from "react";
import { usePipelineCanvasContext } from "../contexts/PipelineCanvasContext";
import { usePipelineRefs } from "../contexts/PipelineRefsContext";

export const PipelineCanvas = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement | undefined>
>(function PipelineStepsHolder({ children, ...props }, ref) {
  const { scaleFactor } = useCanvasScaling();

  const { pipelineCanvasRef, pipelineViewportRef } = usePipelineRefs();
  const canvasRef = React.useRef<HTMLDivElement>(null);
  const {
    pipelineCanvasState: { pipelineOffset, pipelineCanvasOffset },
  } = usePipelineCanvasContext();

  const adjustedBackgroundSize = 32 * scaleFactor;

  function resizeBackground(
    pipelineViewportRef,
    pipelineCanvasRef,
    canvasRef,
    adjustedBackgroundSize
  ) {
    if (
      pipelineViewportRef.current &&
      pipelineCanvasRef.current &&
      canvasRef.current != null
    ) {
      let offsetViewport = pipelineViewportRef.current?.getBoundingClientRect();
      let offsetCanvas = pipelineCanvasRef.current?.getBoundingClientRect();

      canvasRef.current.style.backgroundSize =
        adjustedBackgroundSize + "px " + adjustedBackgroundSize + "px";
      canvasRef.current.style.backgroundPosition =
        offsetCanvas.x -
        offsetViewport.x +
        "px " +
        (offsetCanvas.y - offsetViewport.y) +
        "px";
    }
  }

  // Directly resize for pipelineOffset
  React.useEffect(() => {
    resizeBackground(
      pipelineViewportRef,
      pipelineCanvasRef,
      canvasRef,
      adjustedBackgroundSize
    );
  }, [pipelineOffset]);

  // Trigger resize to pick up delayed getBoundingClientRect
  // in case of scale/origin change
  React.useEffect(() => {
    setTimeout(() => {
      resizeBackground(
        pipelineViewportRef,
        pipelineCanvasRef,
        canvasRef,
        adjustedBackgroundSize
      );
    }, 1);
  }, [pipelineCanvasOffset, scaleFactor]);

  return (
    <div className="pipeline-canvas-holder" ref={canvasRef}>
      <div
        id="pipeline-canvas"
        className="pipeline-steps-holder"
        ref={ref}
        {...props}
      >
        {children}
      </div>
    </div>
  );
});
