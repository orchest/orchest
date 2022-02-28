import { useForceUpdate } from "@/hooks/useForceUpdate";
import {
  MouseTracker,
  Offset,
  PipelineStepMetaData,
  PipelineStepState,
  PipelineStepStatus,
} from "@/types";
import { SxProps, Theme } from "@mui/material";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { hasValue } from "@orchest/lib-utils";
import classNames from "classnames";
import React from "react";
import { DRAG_CLICK_SENSITIVITY } from "./common";
import { usePipelineEditorContext } from "./contexts/PipelineEditorContext";
import { EventVarsAction } from "./hooks/useEventVars";
import { useUpdateZIndex } from "./hooks/useZIndexMax";

export const STEP_WIDTH = 190;
export const STEP_HEIGHT = 105;

export type ExecutionState = {
  finished_time?: Date;
  server_time?: Date;
  started_time?: Date;
  status: PipelineStepStatus;
};

export const stepStatusMapping: Record<
  string,
  { label: string; sx: SxProps<Theme> }
> = {
  SUCCESS: {
    label: "✓",
    sx: { color: (theme) => theme.palette.success.light },
  },
  FAILURE: {
    label: "✗",
    sx: { color: (theme) => theme.palette.error.light },
  },
  ABORTED: {
    label: "❗",
    sx: { color: (theme) => theme.palette.warning.light },
  },
};

export const StepStatus = ({ value }: { value: string }) => {
  if (!stepStatusMapping[value]) return null;

  const { label, sx } = stepStatusMapping[value];
  return (
    <Typography component="span" sx={{ ...sx, marginRight: 2 }}>
      {label}
    </Typography>
  );
};

const formatSeconds = (seconds: number) => {
  // Hours, minutes and seconds
  let hrs = ~~(seconds / 3600);
  let mins = ~~((seconds % 3600) / 60);
  let secs = ~~seconds % 60;

  let ret = "";
  if (hrs > 0) {
    ret += hrs + "h ";
  }
  if (mins > 0) {
    ret += mins + "m ";
  }
  ret += secs + "s";
  return ret;
};

export const getStateText = (executionState: ExecutionState) => {
  let stateText = "Ready";

  if (executionState.status === "SUCCESS") {
    let seconds = Math.round(
      (executionState.finished_time.getTime() -
        executionState.started_time.getTime()) /
        1000
    );

    stateText = "Completed (" + formatSeconds(seconds) + ")";
  }
  if (executionState.status === "FAILURE") {
    let seconds = 0;

    if (executionState.started_time !== undefined) {
      seconds = Math.round(
        (executionState.finished_time.getTime() -
          executionState.started_time.getTime()) /
          1000
      );
    }

    stateText = "Failure (" + formatSeconds(seconds) + ")";
  }
  if (executionState.status === "STARTED") {
    let seconds = 0;

    if (executionState.started_time !== undefined) {
      seconds = Math.round(
        (executionState.server_time.getTime() -
          executionState.started_time.getTime()) /
          1000
      );
    }

    stateText = "Running (" + formatSeconds(seconds) + ")";
  }
  if (executionState.status == "PENDING") {
    stateText = "Pending";
  }
  if (executionState.status == "ABORTED") {
    stateText = "Aborted";
  }
  return stateText;
};

const PipelineStepComponent = React.forwardRef(function PipelineStep(
  {
    data,
    scaleFactor,
    offset,
    selected,
    zIndexMax,
    movedToTop,
    isSelectorActive,
    isStartNodeOfNewConnection,
    eventVarsDispatch,
    selectedSteps,
    mouseTracker,
    cursorControlledStep,
    savePositions,
    disabledDragging,
    onDoubleClick,
    children, // we leave out the children, so that children doesn't re-render when step is being dragged
  }: {
    data: PipelineStepState;
    scaleFactor: number;
    offset: Offset;
    selected: boolean;
    movedToTop: boolean;
    zIndexMax: React.MutableRefObject<number>;
    isSelectorActive: boolean;
    isStartNodeOfNewConnection: boolean;
    eventVarsDispatch: (value: EventVarsAction) => void;
    selectedSteps: string[];
    mouseTracker: React.MutableRefObject<MouseTracker>;
    cursorControlledStep: string | undefined;
    savePositions: () => void;
    disabledDragging?: boolean;
    onDoubleClick: (stepUUID: string) => void;
    children: React.ReactNode;
  },
  ref: React.MutableRefObject<HTMLDivElement>
) {
  const [, forceUpdate] = useForceUpdate();
  const { metadataPositions } = usePipelineEditorContext();

  // only persist meta_data for manipulating location with a local state
  // the rest will be updated together with pipelineJson (i.e. data)
  const { uuid, title, incoming_connections, meta_data } = data;
  const [metadata, setMetadata] = React.useState<PipelineStepMetaData>(() => ({
    ...meta_data,
  }));

  const isMouseDown = React.useRef(false);

  const dragCount = React.useRef(0);

  const shouldMoveToTop =
    dragCount.current === DRAG_CLICK_SENSITIVITY ||
    isMouseDown.current ||
    (!isSelectorActive && selected && !cursorControlledStep) ||
    cursorControlledStep === uuid ||
    movedToTop;

  const zIndex = useUpdateZIndex(
    shouldMoveToTop,
    zIndexMax,
    incoming_connections.length
  );

  const onMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    isMouseDown.current = true;
    forceUpdate();
  };

  const resetDraggingVariables = React.useCallback(() => {
    if (hasValue(cursorControlledStep)) {
      eventVarsDispatch({
        type: "SET_CURSOR_CONTROLLED_STEP",
        payload: undefined,
      });
    }
    dragCount.current = 0;
    forceUpdate();
  }, [dragCount, forceUpdate, eventVarsDispatch, cursorControlledStep]);

  const onMouseUp = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    isMouseDown.current = false;

    if (isSelectorActive) {
      eventVarsDispatch({ type: "SET_STEP_SELECTOR_INACTIVE" });
    }

    // this is basically on single click
    // because onClick is always called after onMouseUp (i.e. dragCount.current is always 0), we cannot distinguish it within onClick
    // so, we have to handle it in onMouseUp
    if (dragCount.current < DRAG_CLICK_SENSITIVITY && !isSelectorActive) {
      const ctrlKeyPressed = e.ctrlKey || e.metaKey;

      // if this step (and possibly other steps) are selected,
      // press ctrl/cmd and select this step => remove this step from the selection
      if (selected && ctrlKeyPressed) {
        eventVarsDispatch({ type: "DESELECT_STEPS", payload: [uuid] });
        return;
      }
      // only need to re-render if step is not selected
      if (!selected) {
        eventVarsDispatch({
          type: "SELECT_STEPS",
          payload: { uuids: [uuid], inclusive: ctrlKeyPressed },
        });
      }
      resetDraggingVariables();
      return;
    }

    if (hasValue(cursorControlledStep) && cursorControlledStep === uuid) {
      savePositions();
    }

    // this step could have been being dragged, when mouse up, simply reset all variables
    resetDraggingVariables();
  };

  const onClick = (e: React.MouseEvent) => {
    if (e.detail === 1) return; // see explanation in onMouseUp
    if (e.detail === 2) onDoubleClick(uuid);
  };

  const onMouseLeave = () => {
    // if cursor moves too fast, or move out of canvas, we need to remove the dragging state
    isMouseDown.current = false;
    if (selected) {
      resetDraggingVariables();
    }
  };

  // use mouseTracker to get mouse movements
  // mutate the local metadata without update the central state in useEventVars
  // so that we can ONLY re-render selected steps and get away from performance penalty
  React.useEffect(() => {
    const isBeingDragged = () => {
      if (!isMouseDown.current) return false;
      if (dragCount.current < DRAG_CLICK_SENSITIVITY) {
        dragCount.current += 1;
        return false;
      }

      if (!cursorControlledStep) {
        eventVarsDispatch({
          type: "SET_CURSOR_CONTROLLED_STEP",
          payload: uuid,
        });
      }

      return true;
    };
    const onMouseMove = () => {
      if (disabledDragging) {
        resetDraggingVariables();
        return;
      }

      const shouldFollowCursorControlledStep =
        selected &&
        !isSelectorActive &&
        hasValue(cursorControlledStep) &&
        selectedSteps.includes(cursorControlledStep);

      const shouldMoveWithCursor =
        isBeingDragged() || shouldFollowCursorControlledStep;

      if (shouldMoveWithCursor) {
        setMetadata((current) => {
          const { x, y } = mouseTracker.current.delta;
          const updatedPosition = [
            current.position[0] + x,
            current.position[1] + y,
          ] as [number, number];
          metadataPositions.current[uuid] = updatedPosition;
          return {
            ...current,
            position: updatedPosition,
          };
        });
      }
    };
    document.body.addEventListener("mousemove", onMouseMove);
    return () => document.body.removeEventListener("mousemove", onMouseMove);
  }, [
    scaleFactor,
    mouseTracker,
    uuid,
    isSelectorActive,
    selected,
    cursorControlledStep,
    resetDraggingVariables,
    dragCount,
    disabledDragging,
    eventVarsDispatch,
    selectedSteps,
    metadataPositions,
    // was not part of the effect, but we need to update mouse move listener when canvas moved
    offset,
  ]);

  const [x, y] = metadata.position;
  const transform = `translateX(${x}px) translateY(${y}px)`;
  const shouldExpandBackground = cursorControlledStep === uuid;
  return (
    <Box
      data-uuid={uuid}
      data-test-title={title}
      data-test-id={"pipeline-step"}
      ref={ref}
      className={classNames(
        "pipeline-step",
        selected && "selected",
        metadata.hidden && "hidden",
        isStartNodeOfNewConnection && "creating-connection"
      )}
      style={{ transform, zIndex }}
      sx={{
        // create a transparent background to prevent mouse leave occur unexpectedly
        "&::after": shouldExpandBackground
          ? {
              content: "''",
              minWidth: STEP_WIDTH * 5,
              minHeight: STEP_HEIGHT * 5,
              display: "block",
              position: "absolute",
              left: -STEP_WIDTH * 2,
              top: -STEP_HEIGHT * 2,
            }
          : null,
      }}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
    >
      {children}
    </Box>
  );
});

export const PipelineStep = React.memo(PipelineStepComponent);
