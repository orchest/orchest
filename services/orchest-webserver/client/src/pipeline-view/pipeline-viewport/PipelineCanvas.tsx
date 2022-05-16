import React from "react";

export const PipelineCanvas = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement | undefined>
>(function PipelineStepsHolder({ children, ...props }, ref) {
  return (
    <div
      id="pipeline-canvas"
      className="pipeline-steps-holder"
      ref={ref}
      {...props}
    >
      {children}
    </div>
  );
});
