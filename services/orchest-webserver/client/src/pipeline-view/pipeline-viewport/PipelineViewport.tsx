import { useEnvironmentsApi } from "@/api/environments/useEnvironmentsApi";
import { getFilePathRelativeToPipeline } from "@/pipeline-view/file-manager/common";
import { getOffset } from "@/utils/element";
import {
  isSamePoint,
  Point2D,
  stringifyPoint,
  subtractPoints,
} from "@/utils/geometry";
import { setRefs } from "@/utils/refs";
import Box, { BoxProps } from "@mui/material/Box";
import GlobalStyles from "@mui/material/GlobalStyles";
import classNames from "classnames";
import React from "react";
import { createStepAction } from "../action-helpers/eventVarsHelpers";
import {
  DEFAULT_SCALE_FACTOR,
  useCanvasScaling,
} from "../contexts/CanvasScalingContext";
import { usePipelineCanvasContext } from "../contexts/PipelineCanvasContext";
import { usePipelineDataContext } from "../contexts/PipelineDataContext";
import { usePipelineRefs } from "../contexts/PipelineRefsContext";
import { usePipelineUiStateContext } from "../contexts/PipelineUiStateContext";
import { useFileManagerContext } from "../file-manager/FileManagerContext";
import { useValidateFilesOnSteps } from "../file-manager/useValidateFilesOnSteps";
import { INITIAL_PIPELINE_OFFSET } from "../hooks/usePipelineCanvasState";
import { STEP_HEIGHT, STEP_WIDTH } from "../PipelineStep";
import { FullViewportHolder } from "./components/FullViewportHolder";
import { Overlay } from "./components/Overlay";
import { useViewportMouseEvents } from "./hooks/useViewportMouseEvents";
import { NoPipeline } from "./NoPipeline";
import { NoStep } from "./NoStep";
import { PipelineCanvas } from "./PipelineCanvas";
import {
  PipelineViewportContextMenu,
  PipelineViewportContextMenuProvider,
  usePipelineViewportContextMenu,
} from "./PipelineViewportContextMenu";

// scaling and drag-n-drop behaviors can be (almost) entirely separated
// scaling is only mutating the css properties of PipelineCanvas, it has nothing to do with drag-n-drop.
// this means that we don't need to re-render the UI components on PipelineCanvas when zoom-in, zoom-out, panning the canvas
// therefore, all the scaling states should reside in this component
// but some drag-n-drop behaviors requires the offset of PipelineCanvas, so we put usePipelineCanvasState in the context
// so PipelineEditor can use these state

const PipelineViewportComponent = React.forwardRef<HTMLDivElement, BoxProps>(
  function PipelineViewportComponent(
    { children, className, sx, ...props },
    ref
  ) {
    const { dragFile } = useFileManagerContext();
    const {
      disabled,
      pipelineCwd,
      isFetchingPipelineJson,
    } = usePipelineDataContext();

    const environments = useEnvironmentsApi(
      (state) => state.environments || []
    );

    const { scaleFactor, canvasPointAtPointer } = useCanvasScaling();
    const { pipelineCanvasRef, newConnection } = usePipelineRefs();
    const {
      uiState: {
        stepSelector,
        selectedConnection,
        openedStep,
        contextMenuUuid,
        steps,
        isStepsLoaded,
      },
      uiStateDispatch,
    } = usePipelineUiStateContext();

    const {
      pipelineCanvasState: {
        panningState,
        pipelineOffset,
        pipelineOrigin,
        pipelineCanvasOffset,
      },
      setPipelineCanvasOrigin,
    } = usePipelineCanvasContext();

    const localRef = React.useRef<HTMLDivElement | null>(null);

    useViewportMouseEvents();

    React.useEffect(() => {
      if (
        isSamePoint(pipelineOffset, INITIAL_PIPELINE_OFFSET) &&
        scaleFactor === DEFAULT_SCALE_FACTOR
      ) {
        setPipelineCanvasOrigin([0, 0]);
      }
    }, [scaleFactor, pipelineOffset, setPipelineCanvasOrigin]);

    const onMouseDown = (event: React.MouseEvent) => {
      if (disabled || contextMenuUuid || !pipelineCanvasRef.current) return;
      if (selectedConnection) {
        uiStateDispatch({ type: "DESELECT_CONNECTION" });
      }

      const isCreatingSelection = event.button === 0 && panningState === "idle";

      if (isCreatingSelection) {
        uiStateDispatch({
          type: "CREATE_SELECTOR",
          payload: getOffset(pipelineCanvasRef.current),
        });
      }
    };

    const onMouseUp = (e: React.MouseEvent) => {
      if (disabled || Boolean(contextMenuUuid)) return;
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
      (dropPoint: Point2D) => {
        if (!pipelineCwd) return;
        const { allowed } = getApplicableStepFiles();

        const environment = environments.length > 0 ? environments[0] : null;

        allowed.forEach((filePath) => {
          // Adjust filePath to pipelineCwd, incoming filePath is relative to project
          // root.
          const pipelineRelativeFilePath = getFilePathRelativeToPipeline(
            filePath,
            pipelineCwd
          );
          uiStateDispatch(
            createStepAction(environment, dropPoint, pipelineRelativeFilePath)
          );
        });
      },
      [uiStateDispatch, pipelineCwd, environments, getApplicableStepFiles]
    );

    const onDropFiles = React.useCallback(() => {
      // assign a file to a step cannot be handled here because PipelineStep onMouseUp has e.stopPropagation()
      // here we only handle "create a new step".
      const dropPoint = subtractPoints(canvasPointAtPointer(), [
        STEP_WIDTH / 2,
        STEP_HEIGHT / 2,
      ]);

      createStepsWithFiles(dropPoint);
    }, [createStepsWithFiles, canvasPointAtPointer]);

    const { handleContextMenu } = usePipelineViewportContextMenu();

    const hasNoStep = React.useMemo(
      () => isStepsLoaded && Object.keys(steps).length === 0,
      [steps, isStepsLoaded]
    );

    const showIllustration = !isFetchingPipelineJson && (disabled || hasNoStep);

    return (
      <Box
        className={classNames("pipeline-viewport", panningState, className)}
        ref={setRefs(localRef, ref)}
        sx={{
          height: "100%",
          width: "100%",
          overflow: "hidden",
          position: "absolute",
          touchAction: "none",
          ...sx,
        }}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onContextMenu={(event) => handleContextMenu(event, "viewport")}
        {...props}
      >
        <GlobalStyles
          styles={{
            "html, body": { overscrollBehaviorX: "none" },
          }}
        />
        <PipelineCanvas
          ref={pipelineCanvasRef}
          style={{
            transformOrigin: `${pipelineOrigin[0]}px ${pipelineOrigin[1]}px`,
            transform:
              `translate(${stringifyPoint(pipelineOffset, "px")}) ` +
              `scale(${scaleFactor})`,
            left: pipelineCanvasOffset[0],
            top: pipelineCanvasOffset[1],
          }}
        >
          {showIllustration && <Overlay />}
          {children}
          <PipelineViewportContextMenu />
        </PipelineCanvas>
        {showIllustration && (
          <FullViewportHolder>
            {disabled && <NoPipeline />}
            {!disabled && hasNoStep && <NoStep />}
          </FullViewportHolder>
        )}
      </Box>
    );
  }
);

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
