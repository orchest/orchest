import { useAppContext } from "@/contexts/AppContext";
import { isValidFile } from "@/hooks/useCheckFileValidity";
import { useForceUpdate } from "@/hooks/useForceUpdate";
import {
  Connection,
  PipelineStepMetaData,
  PipelineStepState,
  PipelineStepStatus,
  Position,
} from "@/types";
import Box from "@mui/material/Box";
import { hasValue } from "@orchest/lib-utils";
import classNames from "classnames";
import React from "react";
import { DRAG_CLICK_SENSITIVITY } from "./common";
import { usePipelineCanvasContext } from "./contexts/PipelineCanvasContext";
import { usePipelineEditorContext } from "./contexts/PipelineEditorContext";
import { getFilePathForRelativeToProject } from "./file-manager/common";
import { useFileManagerContext } from "./file-manager/FileManagerContext";
import { useValidateFilesOnSteps } from "./file-manager/useValidateFilesOnSteps";
import { useUpdateZIndex } from "./hooks/useZIndexMax";
import { InteractiveConnection } from "./pipeline-connection/InteractiveConnection";

export const STEP_WIDTH = 190;
export const STEP_HEIGHT = 105;

export type ExecutionState = {
  finished_time?: Date;
  server_time?: Date;
  started_time?: Date;
  status: PipelineStepStatus;
};

const stepStatusMapping: Record<string, JSX.Element> = {
  SUCCESS: <span className="success">✓ </span>,
  FAILURE: <span className="failure">✗ </span>,
  ABORTED: <span className="aborted">❗ </span>,
};

export const StepStatus = ({ value }: { value: string }) => {
  if (!stepStatusMapping[value]) return null;
  return stepStatusMapping[value];
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

  if (
    executionState.status === "SUCCESS" &&
    executionState.started_time &&
    executionState.finished_time
  ) {
    let seconds = Math.round(
      (executionState.finished_time.getTime() -
        executionState.started_time.getTime()) /
        1000
    );

    stateText = "Completed (" + formatSeconds(seconds) + ")";
  }
  if (executionState.status === "FAILURE") {
    let seconds = 0;

    if (executionState.started_time && executionState.finished_time) {
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

    if (executionState.started_time && executionState.server_time) {
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

const PipelineStepComponent = React.forwardRef<
  HTMLDivElement,
  {
    data: PipelineStepState;
    selected: boolean;
    movedToTop: boolean;
    isStartNodeOfNewConnection: boolean;
    savePositions: () => void;
    onDoubleClick: (stepUUID: string) => void;
    interactiveConnections: Connection[];
    getPosition: (node: HTMLElement | undefined | null) => Position | null;
    children: React.ReactNode;
  }
>(function PipelineStep(
  {
    data,
    selected,
    movedToTop,
    isStartNodeOfNewConnection,
    savePositions,
    onDoubleClick,
    // the cursor-controlled step also renders all the interactive connections, to ensure the precision of the positions
    interactiveConnections,
    getPosition,
    children, // expose children, so that children doesn't re-render when step is being dragged
  },
  ref
) {
  const [, forceUpdate] = useForceUpdate();
  const { setAlert } = useAppContext();
  const {
    metadataPositions,
    projectUuid,
    pipelineUuid,
    pipelineCwd,
    stepDomRefs,
    isReadOnly,
    zIndexMax,
    dispatch,
    mouseTracker,
    newConnection,
    keysDown,
    eventVars: {
      cursorControlledStep,
      selectedSteps,
      stepSelector,
      selectedConnection,
    },
  } = usePipelineEditorContext();
  const { selectedFiles, dragFile, resetMove } = useFileManagerContext();

  const {
    pipelineCanvasState: { panningState },
  } = usePipelineCanvasContext();

  const isSelectorActive = stepSelector.active;
  const disabledDragging = isReadOnly || panningState === "panning";

  // only persist meta_data for manipulating location with a local state
  // the rest will be updated together with pipelineJson (i.e. data)
  const { uuid, title, meta_data, file_path } = data;
  const [metadata, setMetadata] = React.useState<PipelineStepMetaData>(() => ({
    ...meta_data,
  }));

  const isMouseDown = React.useRef(false);

  const dragCount = React.useRef(0);

  const isOnDragging = dragCount.current === DRAG_CLICK_SENSITIVITY;

  const shouldMoveToTop =
    isOnDragging ||
    isMouseDown.current ||
    movedToTop ||
    (!isSelectorActive && (selected || cursorControlledStep === uuid));

  const zIndex = useUpdateZIndex(shouldMoveToTop, zIndexMax);

  const resetDraggingVariables = React.useCallback(() => {
    if (hasValue(cursorControlledStep)) {
      dispatch({
        type: "SET_CURSOR_CONTROLLED_STEP",
        payload: undefined,
      });
    }
    isMouseDown.current = false;
    dragCount.current = 0;
    forceUpdate();
  }, [dragCount, forceUpdate, dispatch, cursorControlledStep]);

  const finishDragging = React.useCallback(() => {
    savePositions();
    resetDraggingVariables();
    document.body.removeEventListener("mouseup", finishDragging);
  }, [resetDraggingVariables, savePositions]);

  const getApplicableStepFiles = useValidateFilesOnSteps();

  // handles all mouse up cases except "just finished dragging"
  // because user might start to drag while their cursor is not over this step (due to the mouse sensitivity)
  // so this onMouseUp on the DOM won't work
  const onMouseUp = (e: React.MouseEvent) => {
    // user is panning the canvas
    if (keysDown.has("Space")) return;

    e.stopPropagation();
    e.preventDefault();

    if (dragFile) {
      if (selectedFiles.length > 1) {
        setAlert("Error", "Unable to assign multiple files to a single step.");
        resetMove();
        return;
      }

      const { forbidden, usedNotebookFiles } = getApplicableStepFiles(uuid);
      if (forbidden.length + usedNotebookFiles.length > 0) {
        resetMove();
        return;
      }

      if (!pipelineCwd) return;
      dispatch({
        type: "ASSIGN_FILE_TO_STEP",
        payload: {
          stepUuid: uuid,
          filePath: getFilePathForRelativeToProject(dragFile.path, pipelineCwd),
        },
      });
      resetMove();
    }

    if (isSelectorActive) {
      dispatch({ type: "SET_STEP_SELECTOR_INACTIVE" });
    }

    if (newConnection.current) {
      dispatch({ type: "MAKE_CONNECTION", payload: uuid });
    }

    // this condition means user is just done dragging
    // we cannot clean up dragging variables here
    // skip resetDraggingVariables and let onClick take over (onClick is called right after onMouseUp)
    if (isMouseDown.current && isOnDragging) return;

    // this happens if user started dragging on the edge (i.e. continue dragging without actually hovering on the step)
    // and release their cursor on non-canvas elements (e.g. other steps, connections)
    // dragging should be finished here, because onClick will not be fired (user didn't mouse down in the first place)
    if (!isMouseDown.current) finishDragging();

    resetDraggingVariables();
  };

  React.useEffect(() => {
    // because user might accidentally start dragging while their cursor is not over this DOM element
    // this mouse event listener is used to "finish" the dragging behavior
    if (isMouseDown.current) {
      document.body.addEventListener("mouseup", finishDragging);
    }
    return () => document.body.removeEventListener("mouseup", finishDragging);
  }, [finishDragging]);

  const onMouseDown = React.useCallback(
    (e: React.MouseEvent) => {
      // user is panning the canvas
      if (keysDown.has("Space")) return;

      e.stopPropagation();
      e.preventDefault();
      if (e.button === 0) {
        isMouseDown.current = true;
        forceUpdate();
      }
    },
    [forceUpdate, keysDown]
  );

  const onClick = async (e: React.MouseEvent) => {
    // user is panning the canvas
    if (keysDown.has("Space")) return;

    e.stopPropagation();
    e.preventDefault();
    if (e.detail === 1) {
      // even user is actually dragging, React still sees it as a click
      // maybe because cursor remains on the same position over the DOM
      // we can intercept this "click" event and handle it as a "done-dragging" case
      if (isOnDragging) {
        finishDragging();
        return;
      }

      const ctrlKeyPressed = e.ctrlKey || e.metaKey;

      // if this step (and possibly other steps) are selected,
      // press ctrl/cmd and select this step => remove this step from the selection
      if (selected && ctrlKeyPressed) {
        dispatch({ type: "DESELECT_STEPS", payload: [uuid] });
        return;
      }
      // only need to re-render if step is not selected
      if (!selected) {
        dispatch({
          type: "SELECT_STEPS",
          payload: { uuids: [uuid], inclusive: ctrlKeyPressed },
        });
      }
      if (selected) {
        dispatch({ type: "SET_OPENED_STEP", payload: uuid });
      }
      resetDraggingVariables();
    }
    if (e.detail === 2 && projectUuid && pipelineUuid) {
      const valid = await isValidFile(projectUuid, pipelineUuid, file_path);
      if (valid) onDoubleClick(uuid);
    }
  };

  const onMouseLeave = React.useCallback(
    (e: MouseEvent) => {
      // user is panning the canvas
      if (keysDown.has("Space")) return;

      e.preventDefault();
      e.stopPropagation();
      // if cursor moves too fast, or move out of canvas, we need to remove the dragging state
      isMouseDown.current = false;
      savePositions();
      if (selected) {
        resetDraggingVariables();
      }
    },
    [resetDraggingVariables, savePositions, selected, keysDown]
  );

  const detectDraggingBehavior = React.useCallback(() => {
    if (!isMouseDown.current) return;
    if (dragCount.current < DRAG_CLICK_SENSITIVITY) {
      dragCount.current += 1;
      return;
    }

    if (!cursorControlledStep) {
      dispatch({
        type: "SET_CURSOR_CONTROLLED_STEP",
        payload: uuid,
      });
    }
  }, [cursorControlledStep, dispatch, uuid]);

  const onMouseMove = React.useCallback(() => {
    // user is panning the canvas
    if (keysDown.has("Space")) return;

    if (disabledDragging) {
      resetDraggingVariables();
      return;
    }

    if (!hasValue(cursorControlledStep)) detectDraggingBehavior();

    // user is dragging this step
    const isBeingDragged = cursorControlledStep === uuid;
    // multiple steps selected, user dragged one of the selected steps (but not the current one)
    const shouldFollowControlledStep =
      selected &&
      !isSelectorActive &&
      hasValue(cursorControlledStep) &&
      selectedSteps.includes(cursorControlledStep);

    const shouldMoveWithCursor = isBeingDragged || shouldFollowControlledStep;

    if (shouldMoveWithCursor) {
      setMetadata((current) => {
        const { x, y } = mouseTracker.current.delta;
        const updatedPosition = [
          current.position[0] + x,
          current.position[1] + y,
        ] as [number, number];
        metadataPositions.current[uuid] = updatedPosition;
        return { ...current, position: updatedPosition };
      });
    }
  }, [
    mouseTracker,
    keysDown,
    uuid,
    isSelectorActive,
    selected,
    cursorControlledStep,
    resetDraggingVariables,
    disabledDragging,
    selectedSteps,
    metadataPositions,
    detectDraggingBehavior,
  ]);

  // use mouseTracker to get mouse movements
  // mutate the local metadata without update the central state in useEventVars
  // ONLY selected steps are re-rendered, so we can get away from performance penalty
  React.useEffect(() => {
    document.body.addEventListener("mousemove", onMouseMove);
    document.body.addEventListener("mouseleave", onMouseLeave);
    return () => {
      document.body.removeEventListener("mousemove", onMouseMove);
      document.body.removeEventListener("mouseleave", onMouseLeave);
    };
  }, [onMouseMove, onMouseLeave]);

  const [x, y] = metadata.position;
  const transform = `translateX(${x}px) translateY(${y}px)`;
  const isCursorControlled = cursorControlledStep === uuid;

  const [isHovering, setIsHovering] = React.useState(false);

  const onMouseOverContainer = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (newConnection.current || dragFile) setIsHovering(true);
  };
  const onMouseOutContainer = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsHovering(false);
  };

  return (
    <>
      <Box
        data-type="step"
        data-uuid={uuid}
        data-test-title={title}
        data-test-id={"pipeline-step"}
        ref={ref}
        className={classNames(
          "pipeline-step",
          (selected || isHovering) && "selected",
          metadata.hidden && "hidden",
          isStartNodeOfNewConnection && "creating-connection"
        )}
        style={{ transform, zIndex }}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onMouseOver={onMouseOverContainer}
        onMouseOut={onMouseOutContainer}
        onContextMenu={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
        onClick={onClick}
      >
        {children}
      </Box>
      {isCursorControlled && // the cursor-controlled step also renders all the interactive connections
        interactiveConnections.map((connection) => {
          if (!connection) return null;

          const { startNodeUUID, endNodeUUID } = connection;
          const startNode = stepDomRefs.current[`${startNodeUUID}-outgoing`];
          const endNode = endNodeUUID
            ? stepDomRefs.current[`${endNodeUUID}-incoming`]
            : undefined;

          // startNode is required
          if (!startNode) return null;

          // if the connection is attached to a selected step,
          // the connection should update its start/end node, to move along with the step
          const shouldUpdateStart =
            cursorControlledStep === startNodeUUID ||
            (selectedSteps.includes(startNodeUUID) &&
              selectedSteps.includes(cursorControlledStep));

          const shouldUpdateEnd =
            cursorControlledStep === endNodeUUID ||
            (selectedSteps.includes(endNodeUUID || "") &&
              selectedSteps.includes(cursorControlledStep));

          const shouldUpdate = [shouldUpdateStart, shouldUpdateEnd] as [
            boolean,
            boolean
          ];

          let startNodePosition = getPosition(startNode);
          let endNodePosition = getPosition(endNode);

          const key = `${startNodeUUID}-${endNodeUUID}-interactive`;
          const selected =
            selectedConnection?.startNodeUUID === startNodeUUID &&
            selectedConnection?.endNodeUUID === endNodeUUID;

          return (
            startNodePosition && (
              <InteractiveConnection
                key={key}
                startNodeUUID={startNodeUUID}
                endNodeUUID={endNodeUUID}
                getPosition={getPosition}
                selected={selected}
                stepDomRefs={stepDomRefs}
                startNodeX={startNodePosition.x}
                startNodeY={startNodePosition.y}
                endNodeX={endNodePosition?.x}
                endNodeY={endNodePosition?.y}
                shouldUpdate={shouldUpdate}
              />
            )
          );
        })}
    </>
  );
});

export const PipelineStep = React.memo(PipelineStepComponent);
