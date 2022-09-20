import { useCanvasScaling } from "@/pipeline-view/contexts/CanvasScalingContext";
import React from "react";
import { usePipelineCanvasContext } from "../contexts/PipelineCanvasContext";

export const PipelineCanvas = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement | undefined>
>(function PipelineStepsHolder({ children, ...props }, ref) {
  const { scaleFactor } = useCanvasScaling();
  const {
    pipelineCanvasState: {
      pipelineOffset,
      pipelineOrigin,
      pipelineCanvasOffset,
    },
  } = usePipelineCanvasContext();

  const adjustedBackgroundSize = 32 * scaleFactor;
  const canvasHolderStyling = {
    backgroundSize:
      adjustedBackgroundSize + "px " + adjustedBackgroundSize + "px",
    backgroundPosition:
      pipelineOffset[0] +
      pipelineOrigin[0] +
      pipelineCanvasOffset[0] +
      "px " +
      (pipelineOffset[1] + pipelineOrigin[1] + pipelineCanvasOffset[1]) +
      "px",
  };

  return (
    <div className="pipeline-canvas-holder" style={canvasHolderStyling}>
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
