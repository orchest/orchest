import { useGlobalContext } from "@/contexts/GlobalContext";
import { useActivePipelineRun } from "@/hooks/useActivePipelineRun";
import { isValidFile } from "@/hooks/useCheckFileValidity";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useForceUpdate } from "@/hooks/useForceUpdate";
import { Connection, StepMetaData, StepState } from "@/types";
import { Point2D } from "@/utils/geometry";
import { getMouseDelta } from "@/utils/mouse";
import { statusColor } from "@/utils/system-status";
import Box from "@mui/material/Box";
import { lighten } from "@mui/material/styles";
import { ALLOWED_STEP_EXTENSIONS, hasValue } from "@orchest/lib-utils";
import classNames from "classnames";
import React from "react";
import { DRAG_CLICK_SENSITIVITY } from "./common";
import { useCanvasScaling } from "./contexts/CanvasScalingContext";
import { usePipelineCanvasContext } from "./contexts/PipelineCanvasContext";
import { usePipelineDataContext } from "./contexts/PipelineDataContext";
import { usePipelineRefs } from "./contexts/PipelineRefsContext";
import { usePipelineUiStateContext } from "./contexts/PipelineUiStateContext";
import { getFilePathRelativeToPipeline } from "./file-manager/common";
import { useFileManagerContext } from "./file-manager/FileManagerContext";
import { useValidateFilesOnSteps } from "./file-manager/useValidateFilesOnSteps";
import { useFileManagerState } from "./hooks/useFileManagerState";
import { useUpdateZIndex } from "./hooks/useZIndexMax";
import { InteractiveConnection } from "./pipeline-connection/InteractiveConnection";
import { usePipelineViewportContextMenu } from "./pipeline-viewport/PipelineViewportContextMenu";

export const STEP_WIDTH = 200;
export const STEP_HEIGHT = 105;

type PipelineStepProps = {
  data: StepState;
  selected: boolean;
  movedToTop: boolean;
  isStartNodeOfNewConnection: boolean;
  savePositions: () => void;
  onDoubleClick: (stepUUID: string) => void;
  interactiveConnections: Connection[];
  getPosition: (node: HTMLElement) => Point2D;
  children: React.ReactNode;
};

const PipelineStepComponent = React.forwardRef<
  HTMLDivElement,
  PipelineStepProps
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
  const { setAlert } = useGlobalContext();
  const { projectUuid, jobUuid } = useCustomRoute();
  const {
    pipelineUuid,
    pipelineCwd,
    isReadOnly,
    runUuid,
  } = usePipelineDataContext();
  const { scaleFactor } = useCanvasScaling();
  const {
    uiState: { contextMenuUuid },
  } = usePipelineUiStateContext();
  const {
    keysDown,
    draggedStepPositions,
    stepRefs,
    zIndexMax,
    newConnection,
  } = usePipelineRefs();
  const {
    uiState: { stepSelector, grabbedStep, selectedSteps, selectedConnection },
    uiStateDispatch,
  } = usePipelineUiStateContext();
  const selectedFiles = useFileManagerState((state) => state.selected);
  const { dragFile, resetMove } = useFileManagerContext();

  const {
    pipelineCanvasState: { panningState },
  } = usePipelineCanvasContext();

  const isSelectorActive = stepSelector.active;
  const disabledDragging = isReadOnly || panningState === "panning";

  // only persist meta_data for manipulating location with a local state
  // the rest will be updated together with pipelineJson (i.e. data)
  const { uuid, title, meta_data, file_path } = data;
  const [metadata, setMetadata] = React.useState<StepMetaData>(() => ({
    ...meta_data,
  }));

  const isMouseDown = React.useRef(false);

  const dragCount = React.useRef(0);

  const isDragging = dragCount.current === DRAG_CLICK_SENSITIVITY;

  const shouldMoveToTop =
    isDragging ||
    isMouseDown.current ||
    movedToTop ||
    (!isSelectorActive && (selected || grabbedStep === uuid));

  const zIndex = useUpdateZIndex(shouldMoveToTop, zIndexMax);

  const resetDraggingVariables = React.useCallback(() => {
    if (hasValue(grabbedStep)) {
      uiStateDispatch({
        type: "SET_CURSOR_CONTROLLED_STEP",
        payload: undefined,
      });
    }
    isMouseDown.current = false;
    dragCount.current = 0;
    forceUpdate();
  }, [dragCount, forceUpdate, uiStateDispatch, grabbedStep]);

  const finishDragging = React.useCallback(() => {
    savePositions();
    resetDraggingVariables();
    document.body.removeEventListener("mouseup", finishDragging);
  }, [resetDraggingVariables, savePositions]);

  const getApplicableStepFiles = useValidateFilesOnSteps();

  // handles all mouse up cases except "just finished dragging"
  // because user might start to drag while their cursor is not over this step (due to the mouse sensitivity)
  // so this onMouseUp on the DOM won't work
  const onMouseUp = (event: React.MouseEvent) => {
    // user is panning the canvas
    if (keysDown.has("Space")) return;

    event.stopPropagation();
    event.preventDefault();

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
      uiStateDispatch({
        type: "ASSIGN_FILE_TO_STEP",
        payload: {
          stepUuid: uuid,
          filePath: getFilePathRelativeToPipeline(dragFile.path, pipelineCwd),
        },
      });
      resetMove();
    }

    if (isSelectorActive) {
      uiStateDispatch({ type: "SET_STEP_SELECTOR_INACTIVE" });
    }

    if (newConnection.current) {
      uiStateDispatch({ type: "MAKE_CONNECTION", payload: uuid });
    }

    // this condition means user is just done dragging
    // we cannot clean up dragging variables here
    // skip resetDraggingVariables and let onClick take over (onClick is called right after onMouseUp)
    if (isMouseDown.current && isDragging) return;

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
    (event: React.MouseEvent) => {
      // user is panning the canvas or context menu is open
      if (keysDown.has("Space") || Boolean(contextMenuUuid)) return;

      event.stopPropagation();
      event.preventDefault();
      if (event.button === 0) {
        isMouseDown.current = true;
        forceUpdate();
      }
    },
    [forceUpdate, keysDown, contextMenuUuid]
  );

  const { handleContextMenu } = usePipelineViewportContextMenu();

  const onContextMenu = async (event: React.MouseEvent) => {
    const ctrlKeyPressed = event.ctrlKey || event.metaKey;
    if (!selected) {
      uiStateDispatch({
        type: "SELECT_STEPS",
        payload: { uuids: [uuid], inclusive: ctrlKeyPressed },
      });
    }
    handleContextMenu(event, uuid);
  };

  const onClick = async (event: React.MouseEvent) => {
    // user is panning the canvas or context menu is open
    if (keysDown.has("Space") || Boolean(contextMenuUuid)) return;

    event.stopPropagation();
    event.preventDefault();

    if (event.detail === 1) {
      // even user is actually dragging, React still sees it as a click
      // maybe because cursor remains on the same position over the DOM
      // we can intercept this "click" event and handle it as a "done-dragging" case
      if (isDragging) {
        finishDragging();
        return;
      }

      const ctrlKeyPressed = event.ctrlKey || event.metaKey;

      // if this step (and possibly other steps) are selected,
      // press ctrl/cmd and select this step => remove this step from the selection
      if (selected && ctrlKeyPressed) {
        uiStateDispatch({ type: "DESELECT_STEPS", payload: [uuid] });
        return;
      }
      // only need to re-render if step is not selected
      if (!selected) {
        uiStateDispatch({
          type: "SELECT_STEPS",
          payload: { uuids: [uuid], inclusive: ctrlKeyPressed },
        });
      }
      if (selected) {
        uiStateDispatch({ type: "SET_OPENED_STEP", payload: uuid });
      }
      resetDraggingVariables();
    }
    if (event.detail === 2 && projectUuid && pipelineUuid) {
      const valid = await isValidFile({
        projectUuid,
        pipelineUuid,
        jobUuid,
        runUuid,
        path: file_path,
        allowedExtensions: ALLOWED_STEP_EXTENSIONS,
      });
      if (valid) onDoubleClick(uuid);
    }
  };

  const onMouseLeave = React.useCallback(
    (event: MouseEvent) => {
      // user is panning the canvas
      if (keysDown.has("Space")) return;

      event.preventDefault();
      event.stopPropagation();
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

    if (!grabbedStep) {
      uiStateDispatch({
        type: "SET_CURSOR_CONTROLLED_STEP",
        payload: uuid,
      });
    }
  }, [grabbedStep, uiStateDispatch, uuid]);

  const onMouseMove = React.useCallback(() => {
    // user is panning the canvas
    if (keysDown.has("Space")) return;

    if (disabledDragging) {
      return;
    }

    if (!hasValue(grabbedStep)) detectDraggingBehavior();

    // user is dragging this step
    const isBeingDragged = grabbedStep === uuid;
    // multiple steps selected, user dragged one of the selected steps (but not the current one)
    const shouldFollowControlledStep =
      selected &&
      !isSelectorActive &&
      hasValue(grabbedStep) &&
      selectedSteps.includes(grabbedStep);

    const shouldMoveWithCursor = isBeingDragged || shouldFollowControlledStep;

    if (shouldMoveWithCursor) {
      setMetadata((current) => {
        const [x, y] = current.position;
        const [mouseX, mouseY] = getMouseDelta();
        const newPosition: Point2D = [
          x + mouseX / scaleFactor,
          y + mouseY / scaleFactor,
        ];

        draggedStepPositions.current[uuid] = newPosition;
        return { ...current, position: newPosition };
      });
    }
  }, [
    keysDown,
    disabledDragging,
    grabbedStep,
    detectDraggingBehavior,
    uuid,
    selected,
    isSelectorActive,
    selectedSteps,
    scaleFactor,
    draggedStepPositions,
  ]);

  const currentRun = useActivePipelineRun();
  const status = currentRun.stepStates?.[uuid]?.status;

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
  const isGrabbed = grabbedStep === uuid;

  const [isHovering, setIsHovering] = React.useState(false);

  const onMouseOverContainer = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (newConnection.current || dragFile) setIsHovering(true);
  };
  const onMouseOutContainer = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsHovering(false);
  };

  const backgroundBase = statusColor(status);

  return (
    <>
      <Box
        data-type="step"
        data-uuid={uuid}
        data-test-title={title}
        data-test-id="pipeline-step"
        ref={ref}
        sx={{
          position: "absolute",
          transition:
            "background-color 600ms ease-in, border-color 200ms ease-out",
          backgroundColor: lighten(backgroundBase, 0.875),
          "&:hover": {
            backgroundColor: lighten(backgroundBase, 0.825),
          },
          border: (theme) =>
            selected
              ? `2px solid ${theme.palette.primary.main}`
              : `2px solid transparent`,
          borderRadius: 2,
          cursor: "pointer",
          userSelect: "none",
          height: STEP_HEIGHT,
          width: STEP_WIDTH,
          textAlign: "center",
          zIndex: 2,
          lineHeight: "normal",
          boxShadow: 2,
          visibility: metadata.hidden ? "hidden" : "visible",
        }}
        className={classNames(
          "pipeline-step",
          (selected || isHovering) && "selected",
          isStartNodeOfNewConnection && "creating-connection"
        )}
        style={{ transform, zIndex }}
        onContextMenu={onContextMenu}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onMouseOver={onMouseOverContainer}
        onMouseOut={onMouseOutContainer}
        onClick={onClick}
      >
        {children}
      </Box>
      {isGrabbed && // the cursor-controlled step also renders all the interactive connections
        interactiveConnections.map((connection) => {
          if (!connection) return null;

          const { startNodeUUID, endNodeUUID } = connection;

          if (!endNodeUUID) return null;

          const startNode = stepRefs.current[`${startNodeUUID}-outgoing`];
          const endNode = endNodeUUID
            ? stepRefs.current[`${endNodeUUID}-incoming`]
            : undefined;

          // startNode is required
          if (!startNode) return null;

          // if the connection is attached to a selected step,
          // the connection should update its start/end node, to move along with the step
          const shouldUpdateStart =
            grabbedStep === startNodeUUID ||
            (selectedSteps.includes(startNodeUUID) &&
              selectedSteps.includes(grabbedStep));

          const shouldUpdateEnd =
            grabbedStep === endNodeUUID ||
            (selectedSteps.includes(endNodeUUID || "") &&
              selectedSteps.includes(grabbedStep));

          const shouldUpdate = [shouldUpdateStart, shouldUpdateEnd] as [
            boolean,
            boolean
          ];

          const startPoint = getPosition(startNode);
          const endPoint = endNode ? getPosition(endNode) : undefined;

          const key = `${startNodeUUID}-${endNodeUUID}-interactive`;
          const selected =
            selectedConnection?.startNodeUUID === startNodeUUID &&
            selectedConnection?.endNodeUUID === endNodeUUID;

          return (
            startPoint && (
              <InteractiveConnection
                key={key}
                startNodeUUID={startNodeUUID}
                endNodeUUID={endNodeUUID}
                getPosition={getPosition}
                selected={selected}
                startPoint={startPoint}
                endPoint={endPoint}
                shouldUpdate={shouldUpdate}
              />
            )
          );
        })}
    </>
  );
});

export const PipelineStep = React.memo(PipelineStepComponent);
