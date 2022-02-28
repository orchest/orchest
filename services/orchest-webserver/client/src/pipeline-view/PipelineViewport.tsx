import classNames from "classnames";
import React from "react";

const PipelineStepsOuterHolder = (
  { children, className, ...props }: React.PropsWithChildren<any>,
  ref: React.ForwardedRef<HTMLDivElement>
) => {
  return (
    <div
      className={classNames("pipeline-steps-outer-holder", className)}
      ref={ref}
      {...props}
    >
      {children}
    </div>
  );
};

export const PipelineViewport = React.forwardRef(PipelineStepsOuterHolder);
