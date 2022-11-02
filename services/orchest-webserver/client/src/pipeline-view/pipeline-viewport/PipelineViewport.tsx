import { useFileApi } from "@/api/files/useFileApi";
import { FileMap } from "@/utils/file-map";
import { Point2D, stringifyPoint, subtractPoints } from "@/utils/geometry";
import { hasExtension } from "@/utils/path";
import { setRefs } from "@/utils/refs";
import Box, { BoxProps } from "@mui/material/Box";
import GlobalStyles from "@mui/material/GlobalStyles";
import { ALLOWED_STEP_EXTENSIONS } from "@orchest/lib-utils";
import classNames from "classnames";
import React from "react";
import { useCanvasScaling } from "../contexts/CanvasScalingContext";
import { usePipelineCanvasContext } from "../contexts/PipelineCanvasContext";
import { usePipelineDataContext } from "../contexts/PipelineDataContext";
import { usePipelineRefs } from "../contexts/PipelineRefsContext";
import { usePipelineUiStateContext } from "../contexts/PipelineUiStateContext";
import { useFileManagerContext } from "../file-manager/FileManagerContext";
import { useValidateFilesOnSteps } from "../file-manager/useValidateFilesOnSteps";
import { useCreateStep } from "../hooks/useCreateStep";
import { PIPELINE_CANVAS_SIZE } from "../hooks/usePipelineCanvasState";
import { STEP_HEIGHT, STEP_WIDTH } from "../PipelineStep";
import { FullViewportHolder } from "./components/FullViewportHolder";
import { useViewportMouseEvents } from "./hooks/useViewportMouseEvents";
import { NoPipeline } from "./NoPipeline";
import { NoScripts } from "./NoScripts";
import { NoSteps } from "./NoSteps";
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
    const roots = useFileApi((api) => api.roots);
    const { dragFile } = useFileManagerContext();
    const { disabled, isFetchingPipelineJson } = usePipelineDataContext();
    const isFileTreeLoaded = React.useMemo(
      () => Object.keys(roots).length > 0,
      [roots]
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
    } = usePipelineCanvasContext();

    const localRef = React.useRef<HTMLDivElement | null>(null);

    useViewportMouseEvents();

    const onMouseDown = (event: React.MouseEvent) => {
      if (disabled || contextMenuUuid || !pipelineCanvasRef.current) return;
      if (selectedConnection) {
        uiStateDispatch({ type: "DESELECT_CONNECTION" });
      }

      const isCreatingSelection = event.button === 0 && panningState === "idle";

      if (isCreatingSelection) {
        uiStateDispatch({
          type: "CREATE_SELECTOR",
          payload: canvasPointAtPointer(),
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

    const createStep = useCreateStep();

    const createStepsWithFiles = React.useCallback(
      (dropPoint: Point2D) => {
        const { allowed } = getApplicableStepFiles();
        allowed.forEach((filePath) => {
          createStep(filePath, dropPoint);
        });
      },
      [createStep, getApplicableStepFiles]
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

    const hasSteps = React.useMemo(() => {
      return Object.keys(steps).length > 0;
    }, [steps]);

    const hasScripts = React.useMemo(() => {
      // If there are steps: don't traverse the project dir.
      return hasSteps || hasSomeScriptFile(roots["/project-dir"] ?? {});
    }, [roots, hasSteps]);

    const hasEmptyState =
      !isFetchingPipelineJson &&
      isFileTreeLoaded &&
      (disabled || !hasScripts || (isStepsLoaded && !hasSteps));

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
            width: PIPELINE_CANVAS_SIZE,
            height: PIPELINE_CANVAS_SIZE,
            boxSizing: "content-box",
            transformOrigin: `${pipelineOrigin[0]}px ${pipelineOrigin[1]}px`,
            transform:
              `translate(${stringifyPoint(pipelineOffset, "px")}) ` +
              `scale(${scaleFactor})`,
            left: pipelineCanvasOffset[0],
            top: pipelineCanvasOffset[1],
          }}
        >
          {children}
          <PipelineViewportContextMenu />
        </PipelineCanvas>
        {hasEmptyState && (
          <FullViewportHolder>
            <PipelineEmptyState
              hasPipeline={!disabled}
              hasSteps={hasSteps}
              hasScripts={hasScripts}
            />
          </FullViewportHolder>
        )}
      </Box>
    );
  }
);

const PipelineEmptyState = ({
  hasPipeline,
  hasScripts,
  hasSteps,
}: {
  hasPipeline: boolean;
  hasScripts: boolean;
  hasSteps: boolean;
}) => {
  if (!hasPipeline) {
    return <NoPipeline />;
  } else if (!hasSteps && !hasScripts) {
    return <NoScripts />;
  } else if (!hasSteps) {
    return <NoSteps />;
  } else {
    return null;
  }
};

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

const hasSomeScriptFile = (record: FileMap) =>
  Object.keys(record).some((path) =>
    hasExtension(path, ...ALLOWED_STEP_EXTENSIONS)
  );
