import { getHeight, getOffset, getWidth } from "@/utils/jquery-replacement";
import { getScrollLineHeight } from "@/utils/webserver-utils";
import classNames from "classnames";
import React from "react";
import {
  DEFAULT_SCALE_FACTOR,
  originTransformScaling,
  scaleCorrected,
} from "../common";
import { usePipelineEditorContext } from "../contexts/PipelineEditorContext";
import { INITIAL_PIPELINE_POSITION } from "../hooks/usePipelineViewState";
import { PipelineCanvas } from "./PipelineCanvas";

const CANVAS_VIEW_MULTIPLE = 3;

type Props = React.HTMLAttributes<HTMLDivElement> & {
  canvasRef: React.MutableRefObject<HTMLDivElement>;
  centerPipelineOrigin: React.MutableRefObject<() => void>;
};

// scaling and drag-n-drop behaviors can be (almost) entirely separated
// scaling is only mutating the css properties of PipelineCanvas, it has nothing to do with drag-n-drop.
// this means that we don't need to re-render the UI components on PipelineCanvas when zoom-in, zoom-out, panning the canvas
// therefore, all the scaling states should reside in this component
// but some drag-n-drop behaviors requires the offset of PipelineCanvas, so we put usePipelineViewState in the context
// so PipelineEditor can use these state
const PipelineStepsOuterHolder: React.ForwardRefRenderFunction<
  HTMLDivElement,
  Props
> = (
  { children, className, canvasRef, centerPipelineOrigin, ...props },
  ref
) => {
  const {
    pipelineViewState,
    setPipelineViewState,
    eventVars,
    mouseTracker,
    trackMouseMovement,
    dispatch,
  } = usePipelineEditorContext();

  const localRef = React.useRef<HTMLDivElement>(null);
  const [canvasResizeStyle, resizeCanvas] = React.useState<React.CSSProperties>(
    {}
  );

  const getCurrentOrigin = React.useCallback(() => {
    let canvasOffset = getOffset(canvasRef.current);
    let viewportOffset = getOffset(localRef.current);

    const x = canvasOffset.left - viewportOffset.left;
    const y = canvasOffset.top - viewportOffset.top;

    return { x, y };
  }, [canvasRef]);

  const pipelineSetHolderOrigin = React.useCallback(
    (newOrigin: [number, number]) => {
      const [x, y] = newOrigin;
      const currentOrigin = getCurrentOrigin();
      let [translateX, translateY] = originTransformScaling(
        [x, y],
        eventVars.scaleFactor
      );

      setPipelineViewState((current) => ({
        pipelineOrigin: [x, y],
        pipelineStepsHolderOffsetLeft:
          translateX + currentOrigin.x - current.pipelineOffset[0],
        pipelineStepsHolderOffsetTop:
          translateY + currentOrigin.y - current.pipelineOffset[1],
      }));
    },
    [eventVars.scaleFactor, setPipelineViewState, getCurrentOrigin]
  );

  // NOTE: React.useImperativeHandle should only be used in special cases
  // here we have to use it to allow parent component (i.e. PipelineEditor) to center pipeline canvas
  // otherwise, we have to use renderProps, but then we will have more issues
  // e.g. we cannot keep the action buttons above PipelineCanvas
  React.useImperativeHandle(centerPipelineOrigin, () => () => {
    let viewportOffset = getOffset(localRef.current);
    const canvasOffset = getOffset(canvasRef.current);

    let viewportWidth = getWidth(localRef.current);
    let viewportHeight = getHeight(localRef.current);

    let originalX = viewportOffset.left - canvasOffset.left + viewportWidth / 2;
    let originalY = viewportOffset.top - canvasOffset.top + viewportHeight / 2;

    let centerOrigin = [
      scaleCorrected(originalX, eventVars.scaleFactor),
      scaleCorrected(originalY, eventVars.scaleFactor),
    ] as [number, number];

    pipelineSetHolderOrigin(centerOrigin);
  });

  React.useEffect(() => {
    if (
      pipelineViewState.pipelineOffset[0] === INITIAL_PIPELINE_POSITION[0] &&
      pipelineViewState.pipelineOffset[1] === INITIAL_PIPELINE_POSITION[1] &&
      eventVars.scaleFactor === DEFAULT_SCALE_FACTOR
    ) {
      pipelineSetHolderOrigin([0, 0]);
    }
  }, [
    eventVars.scaleFactor,
    pipelineViewState.pipelineOffset,
    pipelineSetHolderOrigin,
  ]);

  const pipelineSetHolderSize = React.useCallback(() => {
    if (!localRef.current) return;
    resizeCanvas({
      width: getWidth(localRef.current) * CANVAS_VIEW_MULTIPLE,
      height: getHeight(localRef.current) * CANVAS_VIEW_MULTIPLE,
    });
  }, [resizeCanvas, localRef]);

  const getMousePositionRelativeToCanvas = (e: React.WheelEvent) => {
    trackMouseMovement(e.clientX, e.clientY); // in case that user start zoom-in/out before moving their cursor
    const { x, y } = mouseTracker.current.client;
    let canvasOffset = getOffset(canvasRef.current);

    return [
      scaleCorrected(x - canvasOffset.left, eventVars.scaleFactor),
      scaleCorrected(y - canvasOffset.top, eventVars.scaleFactor),
    ] as [number, number];
  };

  const onPipelineCanvasWheel = (e: React.WheelEvent) => {
    let pipelineMousePosition = getMousePositionRelativeToCanvas(e);

    // set origin at scroll wheel trigger
    if (
      pipelineMousePosition[0] !== pipelineViewState.pipelineOrigin[0] ||
      pipelineMousePosition[1] !== pipelineViewState.pipelineOrigin[1]
    ) {
      pipelineSetHolderOrigin(pipelineMousePosition);
    }

    /* mouseWheel contains information about the deltaY variable
     * WheelEvent.deltaMode can be:
     * DOM_DELTA_PIXEL = 0x00
     * DOM_DELTA_LINE = 0x01 (only used in Firefox)
     * DOM_DELTA_PAGE = 0x02 (which we'll treat identically to DOM_DELTA_LINE)
     */

    let deltaY =
      e.nativeEvent.deltaMode == 0x01 || e.nativeEvent.deltaMode == 0x02
        ? getScrollLineHeight() * e.nativeEvent.deltaY
        : e.nativeEvent.deltaY;

    dispatch((current) => {
      return {
        type: "SET_SCALE_FACTOR",
        payload: Math.min(
          Math.max(current.scaleFactor - deltaY / 3000, 0.25),
          2
        ),
      };
    });
  };

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
        // in order to manipulate a forwarded ref, we need to create a local ref to capture it
        localRef.current = node;
        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      }}
      onWheel={onPipelineCanvasWheel}
      {...props}
    >
      <PipelineCanvas
        ref={canvasRef}
        style={{
          transformOrigin: `${pipelineViewState.pipelineOrigin[0]}px ${pipelineViewState.pipelineOrigin[1]}px`,
          transform:
            `translateX(${pipelineViewState.pipelineOffset[0]}px) ` +
            `translateY(${pipelineViewState.pipelineOffset[1]}px) ` +
            `scale(${eventVars.scaleFactor})`,
          left: pipelineViewState.pipelineStepsHolderOffsetLeft,
          top: pipelineViewState.pipelineStepsHolderOffsetTop,
          ...canvasResizeStyle,
        }}
      >
        {children}
      </PipelineCanvas>
    </div>
  );
};

export const PipelineViewport = React.forwardRef(PipelineStepsOuterHolder);
