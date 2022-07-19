import { getFilePathForRelativeToProject } from "@/pipeline-view/file-manager/common";
import { Position } from "@/types";
import { getHeight, getOffset, getWidth } from "@/utils/jquery-replacement";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import classNames from "classnames";
import React from "react";
import { createStepAction } from "../action-helpers/eventVarsHelpers";
import { usePipelineCanvasContext } from "../contexts/PipelineCanvasContext";
import { usePipelineDataContext } from "../contexts/PipelineDataContext";
import { usePipelineRefs } from "../contexts/PipelineRefsContext";
import { usePipelineUiStateContext } from "../contexts/PipelineUiStateContext";
import {
  DEFAULT_SCALE_FACTOR,
  useScaleFactor,
} from "../contexts/ScaleFactorContext";
import { useFileManagerContext } from "../file-manager/FileManagerContext";
import { useValidateFilesOnSteps } from "../file-manager/useValidateFilesOnSteps";
import { INITIAL_PIPELINE_POSITION } from "../hooks/usePipelineCanvasState";
import { STEP_HEIGHT, STEP_WIDTH } from "../PipelineStep";
import { PipelineCanvas } from "./PipelineCanvas";
import {
  PipelineViewportContextMenu,
  PipelineViewportContextMenuProvider,
  usePipelineViewportContextMenu,
} from "./PipelineViewportContextMenu";
import { useMouseEventsOnViewport } from "./useMouseEventsOnViewport";

const CANVAS_VIEW_MULTIPLE = 3;

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

const PipelineViewportComponent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function PipelineViewportComponent(
  { children, className, style, ...props },
  ref
) {
  const { dragFile } = useFileManagerContext();
  const { disabled, pipelineCwd, environments } = usePipelineDataContext();

  const {
    scaleFactor,
    getOnCanvasPosition,
    trackMouseMovement,
  } = useScaleFactor();
  const { pipelineCanvasRef, newConnection } = usePipelineRefs();
  const {
    uiState: {
      stepSelector,
      selectedConnection,
      openedStep,
      isContextMenuOpen,
    },
    uiStateDispatch,
    autoLayoutPipeline,
  } = usePipelineUiStateContext();

  const {
    pipelineCanvasState: {
      panningState,
      pipelineOffset,
      pipelineOrigin,
      pipelineStepsHolderOffsetLeft,
      pipelineStepsHolderOffsetTop,
    },
    setPipelineHolderOrigin,
  } = usePipelineCanvasContext();

  const localRef = React.useRef<HTMLDivElement | null>(null);
  const [canvasResizeStyle, resizeCanvas] = React.useState<React.CSSProperties>(
    {}
  );

  useMouseEventsOnViewport();

  React.useEffect(() => {
    if (
      pipelineOffset[0] === INITIAL_PIPELINE_POSITION[0] &&
      pipelineOffset[1] === INITIAL_PIPELINE_POSITION[1] &&
      scaleFactor === DEFAULT_SCALE_FACTOR
    ) {
      setPipelineHolderOrigin([0, 0]);
    }
  }, [scaleFactor, pipelineOffset, setPipelineHolderOrigin]);

  const pipelineSetHolderSize = React.useCallback(() => {
    if (!localRef.current) return;
    resizeCanvas({
      width: getWidth(localRef.current) * CANVAS_VIEW_MULTIPLE,
      height: getHeight(localRef.current) * CANVAS_VIEW_MULTIPLE,
    });
  }, [resizeCanvas, localRef]);

  const onMouseDown = (e: React.MouseEvent) => {
    if (disabled || isContextMenuOpen) return;
    if (selectedConnection) {
      uiStateDispatch({ type: "DESELECT_CONNECTION" });
    }
    // not dragging the canvas, so user must be creating a selection rectangle
    // we need to save the offset of cursor against pipeline canvas
    if (e.button === 0 && panningState === "idle") {
      trackMouseMovement(e.clientX, e.clientY);
      uiStateDispatch({
        type: "CREATE_SELECTOR",
        payload: getOffset(pipelineCanvasRef.current),
      });
    }
  };

  const onMouseUp = (e: React.MouseEvent) => {
    if (disabled || isContextMenuOpen) return;
    if (e.button === 0) {
      if (stepSelector.active) {
        uiStateDispatch({ type: "SET_STEP_SELECTOR_INACTIVE" });
      } else {
        uiStateDispatch({ type: "SELECT_STEPS", payload: { uuids: [] } });
      }

      if (openedStep) {
        uiStateDispatch({ type: "SET_OPENED_STEP", payload: undefined });
      }

      if (newConnection.current) {
        uiStateDispatch({
          type: "REMOVE_CONNECTION",
          payload: newConnection.current,
        });
      }

      if (dragFile) onDropFiles();
    }
  };

  const getApplicableStepFiles = useValidateFilesOnSteps();

  const createStepsWithFiles = React.useCallback(
    (dropPosition: Position) => {
      if (!pipelineCwd) return;
      const { allowed } = getApplicableStepFiles();

      const environment = environments.length > 0 ? environments[0] : null;

      allowed.forEach((filePath) => {
        // Adjust filePath to pipelineCwd, incoming filePath is relative to project
        // root.
        const pipelineRelativeFilePath = getFilePathForRelativeToProject(
          filePath,
          pipelineCwd
        );
        uiStateDispatch(
          createStepAction(environment, dropPosition, pipelineRelativeFilePath)
        );
      });
    },
    [uiStateDispatch, pipelineCwd, environments, getApplicableStepFiles]
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

  React.useEffect(() => {
    pipelineSetHolderSize();
    window.addEventListener("resize", pipelineSetHolderSize);
    return () => {
      window.removeEventListener("resize", pipelineSetHolderSize);
    };
  }, [pipelineSetHolderSize]);

  const { handleContextMenu } = usePipelineViewportContextMenu();

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
      onContextMenu={handleContextMenu}
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
            `scale(${scaleFactor})`,
          left: pipelineStepsHolderOffsetLeft,
          top: pipelineStepsHolderOffsetTop,
          ...canvasResizeStyle,
        }}
      >
        {disabled && <Overlay />}
        {children}
        <PipelineViewportContextMenu autoLayoutPipeline={autoLayoutPipeline} />
      </PipelineCanvas>
    </div>
  );
});

export const PipelineViewport = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function PipelineViewportWithContextMenuProvider(props, ref) {
  return (
    <PipelineViewportContextMenuProvider>
      <PipelineViewportComponent {...props} ref={ref} />
    </PipelineViewportContextMenuProvider>
  );
});
