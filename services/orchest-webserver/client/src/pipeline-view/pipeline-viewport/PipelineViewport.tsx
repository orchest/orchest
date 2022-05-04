import { Position } from "@/types";
import { getHeight, getOffset, getWidth } from "@/utils/jquery-replacement";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { uuidv4 } from "@orchest/lib-utils";
import classNames from "classnames";
import React from "react";
import {
  DEFAULT_SCALE_FACTOR,
  originTransformScaling,
  scaleCorrected,
} from "../common";
import { usePipelineCanvasContext } from "../contexts/PipelineCanvasContext";
import { usePipelineEditorContext } from "../contexts/PipelineEditorContext";
import { getFilePathForRelativeToProject } from "../file-manager/common";
import { useFileManagerContext } from "../file-manager/FileManagerContext";
import { useValidateFilesOnSteps } from "../file-manager/useValidateFilesOnSteps";
import { INITIAL_PIPELINE_POSITION } from "../hooks/usePipelineCanvasState";
import { STEP_HEIGHT, STEP_WIDTH } from "../PipelineStep";
import { PipelineCanvas } from "./PipelineCanvas";
import { useGestureOnViewport } from "./useGestureOnViewport";
import { useKeyboardEventsOnViewport } from "./useKeyboardEventsOnViewport";
import { useMouseEventsOnViewport } from "./useMouseEventsOnViewport";

const CANVAS_VIEW_MULTIPLE = 3;

export type CanvasFunctions = {
  centerPipelineOrigin: () => void;
  centerView: () => void;
};

const Overlay = () => (
  <Box
    sx={{
      width: "100vw",
      height: "100vh",
      backgroundColor: "rgba(0, 0, 0, 0.03)",
      display: "block",
    }}
  />
);

// scaling and drag-n-drop behaviors can be (almost) entirely separated
// scaling is only mutating the css properties of PipelineCanvas, it has nothing to do with drag-n-drop.
// this means that we don't need to re-render the UI components on PipelineCanvas when zoom-in, zoom-out, panning the canvas
// therefore, all the scaling states should reside in this component
// but some drag-n-drop behaviors requires the offset of PipelineCanvas, so we put usePipelineCanvasState in the context
// so PipelineEditor can use these state

export const PipelineViewport = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    canvasFuncRef: React.MutableRefObject<CanvasFunctions | undefined>;
  }
>(function PipelineViewportComponent(
  { children, className, canvasFuncRef, style, ...props },
  ref
) {
  const { dragFile } = useFileManagerContext();
  const {
    disabled,
    eventVars,
    trackMouseMovement,
    dispatch,
    pipelineCwd,
    newConnection,
    environments,
    pipelineCanvasRef,
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

  const localRef = React.useRef<HTMLDivElement | null>(null);
  const [canvasResizeStyle, resizeCanvas] = React.useState<React.CSSProperties>(
    {}
  );

  const getCurrentOrigin = React.useCallback(() => {
    let canvasOffset = getOffset(pipelineCanvasRef.current);
    let viewportOffset = getOffset(localRef.current);

    const x = canvasOffset.left - viewportOffset.left;
    const y = canvasOffset.top - viewportOffset.top;

    return { x, y };
  }, [pipelineCanvasRef]);

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
    const canvasOffset = getOffset(pipelineCanvasRef.current);

    let viewportWidth = getWidth(localRef.current);
    let viewportHeight = getHeight(localRef.current);

    let originalX = viewportOffset.left - canvasOffset.left + viewportWidth / 2;
    let originalY = viewportOffset.top - canvasOffset.top + viewportHeight / 2;

    let centerOrigin = [
      scaleCorrected(originalX, eventVars.scaleFactor),
      scaleCorrected(originalY, eventVars.scaleFactor),
    ] as [number, number];

    pipelineSetHolderOrigin(centerOrigin);
  }, [pipelineCanvasRef, eventVars.scaleFactor, pipelineSetHolderOrigin]);

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

  const onMouseDown = (e: React.MouseEvent) => {
    if (disabled) return;
    if (eventVars.selectedConnection) {
      dispatch({ type: "DESELECT_CONNECTION" });
    }
    // not dragging the canvas, so user must be creating a selection rectangle
    // we need to save the offset of cursor against pipeline canvas
    if (e.button === 0 && panningState === "idle") {
      trackMouseMovement(e.clientX, e.clientY);
      dispatch({
        type: "CREATE_SELECTOR",
        payload: getOffset(pipelineCanvasRef.current),
      });
    }
  };

  const onMouseUp = () => {
    if (disabled) return;
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
  };

  const getApplicableStepFiles = useValidateFilesOnSteps();

  const createStepsWithFiles = React.useCallback(
    (dropPosition: Position) => {
      if (!pipelineCwd) return;
      const { allowed } = getApplicableStepFiles();

      const environment = environments.length > 0 ? environments[0] : null;

      allowed.forEach((filePath) => {
        dispatch({
          type: "CREATE_STEP",
          payload: {
            title: "",
            uuid: uuidv4(),
            incoming_connections: [],
            file_path: getFilePathForRelativeToProject(filePath, pipelineCwd),
            kernel: {
              name: environment?.language || "python",
              display_name: environment?.name || "Python",
            },
            environment: environment?.uuid || "",
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
    const dropPosition = getOnCanvasPosition({
      x: STEP_WIDTH / 2,
      y: STEP_HEIGHT / 2,
    });

    createStepsWithFiles(dropPosition);
  }, [createStepsWithFiles, getOnCanvasPosition]);

  useMouseEventsOnViewport();
  useKeyboardEventsOnViewport(canvasFuncRef);

  React.useEffect(() => {
    pipelineSetHolderSize();
    window.addEventListener("resize", pipelineSetHolderSize);
    return () => {
      window.removeEventListener("resize", pipelineSetHolderSize);
    };
  }, [pipelineSetHolderSize]);

  useGestureOnViewport(localRef, pipelineSetHolderOrigin);

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
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onContextMenu={(e) => {
        e.stopPropagation();
        e.preventDefault();
      }}
      style={{ ...style, touchAction: "none" }}
      {...props}
    >
      {disabled && (
        <Box
          sx={{
            width: "100%" /* Full width (cover the whole page) */,
            height: "100%" /* Full height (cover the whole page) */,
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Paper
            elevation={0}
            sx={{
              backgroundColor: "transparent",
              zIndex: 1,
              padding: (theme) => theme.spacing(10),
              color: (theme) => theme.palette.grey[400],
              borderRadius: (theme) => theme.spacing(1),
            }}
          >
            <Typography
              variant="h4"
              component="h3"
              sx={{
                color: (theme) => theme.palette.grey[400],
              }}
            >
              No pipeline found
            </Typography>
          </Paper>
        </Box>
      )}
      <PipelineCanvas
        ref={pipelineCanvasRef}
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
        {disabled && <Overlay />}
        {children}
      </PipelineCanvas>
    </div>
  );
});
