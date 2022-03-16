import React from "react";

const PipelineStepsHolder = (
  { children, ...props }: React.HTMLAttributes<HTMLDivElement>,
  ref: React.ForwardedRef<HTMLDivElement>
) => {
  return (
    <div className="pipeline-steps-holder" ref={ref} {...props}>
      {children}
    </div>
  );
};

export const PipelineCanvas = React.forwardRef(PipelineStepsHolder);
