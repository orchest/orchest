import React from "react";
import { CANVAS_PADDING } from "./common";

/**
 * To preserve relative positions within the canvas the canvas gets expanded
 * and its content offset with `transform` instead of padded.
 */
const PADDING_TRANSFORM = `translate(${CANVAS_PADDING}px, ${CANVAS_PADDING}px)`;

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
      <div style={{ transform: PADDING_TRANSFORM }}>{children}</div>
    </div>
  );
});
