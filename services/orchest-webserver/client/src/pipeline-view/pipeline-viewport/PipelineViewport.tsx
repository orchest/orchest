import { Position } from "@/types";
import { getHeight, getOffset, getWidth } from "@/utils/jquery-replacement";
import { getScrollLineHeight } from "@/utils/webserver-utils";
import { activeElementIsInput, uuidv4 } from "@orchest/lib-utils";
import classNames from "classnames";
import React from "react";
import {
  DEFAULT_SCALE_FACTOR,
  getScaleCorrectedPosition,
  originTransformScaling,
  scaleCorrected,
} from "../common";
import { usePipelineCanvasContext } from "../contexts/PipelineCanvasContext";
import { usePipelineEditorContext } from "../contexts/PipelineEditorContext";
import { getFilePathForDragFile } from "../file-manager/common";
import { useFileManagerContext } from "../file-manager/FileManagerContext";
import { useValidateFilesOnSteps } from "../file-manager/useValidateFilesOnSteps";
import { INITIAL_PIPELINE_POSITION } from "../hooks/usePipelineCanvasState";
import { STEP_HEIGHT, STEP_WIDTH } from "../PipelineStep";
import { PipelineCanvas } from "./PipelineCanvas";

const CANVAS_VIEW_MULTIPLE = 3;

export type CanvasFunctions = {
  centerPipelineOrigin: () => void;
  centerView: () => void;
};

type Props = React.HTMLAttributes<HTMLDivElement> & {
  canvasRef: React.MutableRefObject<HTMLDivElement>;
  canvasFuncRef: React.MutableRefObject<CanvasFunctions>;
};

// scaling and drag-n-drop behaviors can be (almost) entirely separated
// scaling is only mutating the css properties of PipelineCanvas, it has nothing to do with drag-n-drop.
// this means that we don't need to re-render the UI components on PipelineCanvas when zoom-in, zoom-out, panning the canvas
// therefore, all the scaling states should reside in this component
// but some drag-n-drop behaviors requires the offset of PipelineCanvas, so we put usePipelineCanvasState in the context
// so PipelineEditor can use these state
const PipelineStepsOuterHolder: React.ForwardRefRenderFunction<
  HTMLDivElement,
  Props
> = ({ children, className, canvasRef, canvasFuncRef, ...props }, ref) => {
  const { dragFile } = useFileManagerContext();
  const {
    eventVars,
    mouseTracker,
    trackMouseMovement,
    dispatch,
    keysDown,
    pipelineCwd,
    newConnection,
    environments,
    getOnCanvasPosition,
  } = usePipelineEditorContext();
  const {
    pipelineCanvasState: {
      panningState,
      pipelineOffset,
      pipelineOrigin,
      pipelineStepsHolderOffsetLeft,
      pipelineStepsHolderOffsetTop,
    },
    setPipelineCanvasState,
    resetPipelineCanvas,
  } = usePipelineCanvasContext();

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

      setPipelineCanvasState((current) => ({
        pipelineOrigin: [x, y],
        pipelineStepsHolderOffsetLeft:
          translateX + currentOrigin.x - current.pipelineOffset[0],
        pipelineStepsHolderOffsetTop:
          translateY + currentOrigin.y - current.pipelineOffset[1],
      }));
    },
    [eventVars.scaleFactor, setPipelineCanvasState, getCurrentOrigin]
  );

  const centerView = React.useCallback(() => {
    resetPipelineCanvas();
    dispatch({ type: "SET_SCALE_FACTOR", payload: DEFAULT_SCALE_FACTOR });
  }, [dispatch, resetPipelineCanvas]);

  const centerPipelineOrigin = React.useCallback(() => {
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
  }, [canvasRef, eventVars.scaleFactor, pipelineSetHolderOrigin]);

  // NOTE: React.useImperativeHandle should only be used in special cases
  // here we have to use it to allow parent component (i.e. PipelineEditor) to center pipeline canvas
  // otherwise, we have to use renderProps, but then we will have more issues
  // e.g. we cannot keep the action buttons above PipelineCanvas
  React.useImperativeHandle(
    canvasFuncRef,
    () => ({ centerPipelineOrigin, centerView }),
    [centerPipelineOrigin, centerView]
  );

  React.useEffect(() => {
    const keyDownHandler = (event: KeyboardEvent) => {
      if (activeElementIsInput()) return;

      if (event.key === " " && !keysDown.has("Space")) {
        // if any element is on focus, pressing space bar is equivalent to mouse click
        // therefore it's needed to remove all "focus" state
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        setPipelineCanvasState({ panningState: "ready-to-pan" });
        keysDown.add("Space");
      }
      if (event.key === "h" && !keysDown.has("h")) {
        centerView();
        keysDown.add("h");
      }
    };
    const keyUpHandler = (event: KeyboardEvent) => {
      if (event.key === " ") {
        setPipelineCanvasState({ panningState: "idle" });
        keysDown.delete("Space");
      }
      if (event.key === "h") {
        keysDown.delete("h");
      }
    };

    document.body.addEventListener("keydown", keyDownHandler);
    document.body.addEventListener("keyup", keyUpHandler);
    return () => {
      document.body.removeEventListener("keydown", keyDownHandler);
      document.body.removeEventListener("keyup", keyUpHandler);
    };
  }, [dispatch, keysDown, centerView, setPipelineCanvasState]);

  React.useEffect(() => {
    if (
      pipelineOffset[0] === INITIAL_PIPELINE_POSITION[0] &&
      pipelineOffset[1] === INITIAL_PIPELINE_POSITION[1] &&
      eventVars.scaleFactor === DEFAULT_SCALE_FACTOR
    ) {
      pipelineSetHolderOrigin([0, 0]);
    }
  }, [eventVars.scaleFactor, pipelineOffset, pipelineSetHolderOrigin]);

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
      pipelineMousePosition[0] !== pipelineOrigin[0] ||
      pipelineMousePosition[1] !== pipelineOrigin[1]
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

  const onMouseDown = (e: React.MouseEvent) => {
    const isLeftClick = e.button === 0;

    trackMouseMovement(e.clientX, e.clientY);

    if (isLeftClick && panningState === "ready-to-pan") {
      // space held while clicking, means canvas drag
      setPipelineCanvasState({ panningState: "panning" });
    }

    dispatch({ type: "DESELECT_CONNECTION" });

    // not dragging the canvas, so user must be creating a selection rectangle
    // we need to save the offset of cursor against pipeline canvas
    if (isLeftClick && panningState === "idle") {
      dispatch({
        type: "CREATE_SELECTOR",
        payload: getOffset(canvasRef.current),
      });
    }
  };

  const getApplicableStepFiles = useValidateFilesOnSteps();

  const createStepsWithFiles = React.useCallback(
    (dropPosition: Position) => {
      const { allowed } = getApplicableStepFiles();

      const environment = environments.length > 0 ? environments[0] : null;

      allowed.forEach((filePath) => {
        dispatch({
          type: "CREATE_STEP",
          payload: {
            title: "",
            uuid: uuidv4(),
            incoming_connections: [],
            file_path: getFilePathForDragFile(filePath, pipelineCwd),
            kernel: {
              name: environment?.language || "python",
              display_name: environment?.name || "Python",
            },
            environment: environment?.uuid,
            parameters: {},
            meta_data: {
              position: [dropPosition.x, dropPosition.y],
              hidden: false,
            },
          },
        });
      });
    },
    [dispatch, pipelineCwd, environments, getApplicableStepFiles]
  );

  const onDropFiles = React.useCallback(() => {
    // assign a file to a step cannot be handled here because PipelineStep onMouseUp has e.stopPropagation()
    // here we only handle "create a new step".
    // const targetElement = target as HTMLElement;
    const dropPosition = getOnCanvasPosition({
      x: STEP_WIDTH / 2,
      y: STEP_HEIGHT / 2,
    });

    createStepsWithFiles(dropPosition);
  }, [createStepsWithFiles, getOnCanvasPosition]);

  const onMouseUp = (e: React.MouseEvent) => {
    if (eventVars.stepSelector.active) {
      dispatch({ type: "SET_STEP_SELECTOR_INACTIVE" });
    } else {
      dispatch({ type: "SELECT_STEPS", payload: { uuids: [] } });
    }

    if (eventVars.openedStep) {
      dispatch({ type: "SET_OPENED_STEP", payload: undefined });
    }

    if (newConnection.current) {
      dispatch({ type: "REMOVE_CONNECTION", payload: newConnection.current });
    }

    if (dragFile) onDropFiles();

    const isLeftClick = e.button === 0;

    if (isLeftClick && panningState === "panning") {
      setPipelineCanvasState({ panningState: "ready-to-pan" });
    }
  };

  const hasMouseMoved = React.useRef(false);
  const onMouseMoveViewport = React.useCallback(() => {
    if (!hasMouseMoved.current) {
      // ensure that mouseTracker is in sync, to prevent jumping in some cases.
      hasMouseMoved.current = true;
      return;
    }
    let canvasOffset = getOffset(canvasRef.current);
    // update newConnection's position
    if (newConnection.current) {
      const { x, y } = getScaleCorrectedPosition({
        offset: canvasOffset,
        position: mouseTracker.current.client,
        scaleFactor: eventVars.scaleFactor,
      });

      newConnection.current = { ...newConnection.current, xEnd: x, yEnd: y };
    }

    if (eventVars.stepSelector.active) {
      dispatch({ type: "UPDATE_STEP_SELECTOR", payload: canvasOffset });
    }

    if (panningState === "ready-to-pan") {
      setPipelineCanvasState({ panningState: "panning" });
    }

    if (panningState === "panning") {
      let dx = mouseTracker.current.unscaledDelta.x;
      let dy = mouseTracker.current.unscaledDelta.y;

      setPipelineCanvasState((current) => ({
        pipelineOffset: [
          current.pipelineOffset[0] + dx,
          current.pipelineOffset[1] + dy,
        ],
      }));
    }
  }, [
    dispatch,
    canvasRef,
    eventVars.scaleFactor,
    eventVars.stepSelector.active,
    mouseTracker,
    newConnection,
    panningState,
    setPipelineCanvasState,
  ]);

  const onMouseLeaveViewport = React.useCallback(() => {
    if (eventVars.stepSelector.active) {
      dispatch({ type: "SET_STEP_SELECTOR_INACTIVE" });
    }
    if (newConnection.current) {
      dispatch({ type: "REMOVE_CONNECTION", payload: newConnection.current });
    }
  }, [dispatch, eventVars.stepSelector.active, newConnection]);

  React.useEffect(() => {
    document.body.addEventListener("mousemove", onMouseMoveViewport);
    document.body.addEventListener("mouseleave", onMouseLeaveViewport);
    return () => {
      document.body.removeEventListener("mousemove", onMouseMoveViewport);
      document.body.removeEventListener("mouseleave", onMouseLeaveViewport);
    };
  }, [onMouseLeaveViewport, onMouseMoveViewport]);

  React.useEffect(() => {
    pipelineSetHolderSize();
    window.addEventListener("resize", pipelineSetHolderSize);
    return () => {
      window.removeEventListener("resize", pipelineSetHolderSize);
    };
  }, [pipelineSetHolderSize]);

  return (
    <div
      id="pipeline-viewport"
      className={classNames(
        "pipeline-steps-outer-holder",
        panningState,
        className
      )}
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
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      {...props}
    >
      <PipelineCanvas
        ref={canvasRef}
        style={{
          transformOrigin: `${pipelineOrigin[0]}px ${pipelineOrigin[1]}px`,
          transform:
            `translateX(${pipelineOffset[0]}px) ` +
            `translateY(${pipelineOffset[1]}px) ` +
            `scale(${eventVars.scaleFactor})`,
          left: pipelineStepsHolderOffsetLeft,
          top: pipelineStepsHolderOffsetTop,
          ...canvasResizeStyle,
        }}
      >
        {children}
      </PipelineCanvas>
    </div>
  );
};

export const PipelineViewport = React.forwardRef(PipelineStepsOuterHolder);
