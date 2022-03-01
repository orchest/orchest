import { getHeight, getWidth } from "@/utils/jquery-replacement";
import classNames from "classnames";
import React from "react";

const CANVAS_VIEW_MULTIPLE = 3;

type PipelineStepsOuterHolderProps = React.HTMLAttributes<HTMLDivElement> & {
  resizeCanvas: React.Dispatch<React.SetStateAction<React.CSSProperties>>;
};

const PipelineStepsOuterHolder = (
  {
    children,
    className,
    resizeCanvas,
    ...props
  }: PipelineStepsOuterHolderProps,
  ref: React.ForwardedRef<HTMLDivElement>
) => {
  const localRef = React.useRef<HTMLDivElement>(null);

  const pipelineSetHolderSize = React.useCallback(() => {
    if (!localRef.current) return;
    resizeCanvas({
      width: getWidth(localRef.current) * CANVAS_VIEW_MULTIPLE,
      height: getHeight(localRef.current) * CANVAS_VIEW_MULTIPLE,
    });
  }, [resizeCanvas, localRef]);

  React.useEffect(() => {
    pipelineSetHolderSize();
    window.addEventListener("resize", pipelineSetHolderSize);
    return () => {
      window.removeEventListener("resize", pipelineSetHolderSize);
    };
  }, [pipelineSetHolderSize]);

  return (
    <div
      className={classNames("pipeline-steps-outer-holder", className)}
      ref={(node) => {
        // in order to capture a forwarded ref, we need to create a local ref to capture it
        localRef.current = node;
        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          (ref as React.MutableRefObject<HTMLDivElement>).current = node;
        }
      }}
      {...props}
    >
      {children}
    </div>
  );
};

export const PipelineViewport = React.forwardRef(PipelineStepsOuterHolder);
