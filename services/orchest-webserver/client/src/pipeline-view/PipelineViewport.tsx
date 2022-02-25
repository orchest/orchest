import React from "react";

const PipelineStepsOuterHolder = (
  { children, ...props }: React.PropsWithChildren<any>,
  ref: React.ForwardedRef<HTMLDivElement>
) => {
  return (
    <div className="pipeline-steps-outer-holder" ref={ref} {...props}>
      {children}
    </div>
  );
};

export const PipelineViewport = React.forwardRef(PipelineStepsOuterHolder);
