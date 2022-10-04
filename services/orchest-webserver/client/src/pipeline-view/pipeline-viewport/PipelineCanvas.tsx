import React from "react";
import { PipelineCanvasBackground } from "./PipelineCanvasBackground";

export const PipelineCanvas = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement | undefined>
>(function PipelineCanvas({ children, ...props }, ref) {
  return (
    <div
      id="pipeline-canvas"
      className="pipeline-steps-holder"
      ref={ref}
      {...props}
    >
      <PipelineCanvasBackground />
      {children}
    </div>
  );
});
