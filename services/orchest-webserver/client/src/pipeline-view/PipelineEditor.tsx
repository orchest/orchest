import { HeadsUpDisplay } from "@/components/HeadsUpDisplay";
import { useHasChanged } from "@/hooks/useHasChanged";
import { Connection, StepState } from "@/types";
import { getOffset } from "@/utils/element";
import { createRect, Point2D } from "@/utils/geometry";
import { stepPathToProjectPath } from "@/utils/pipeline";
import { ellipsis } from "@/utils/styles";
import { alpha, Typography } from "@mui/material";
import Stack from "@mui/material/Stack";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { ConnectionDot } from "./ConnectionDot";
import { useCanvasScaling } from "./contexts/CanvasScalingContext";
import { usePipelineDataContext } from "./contexts/PipelineDataContext";
import { usePipelineRefs } from "./contexts/PipelineRefsContext";
import { usePipelineUiStateContext } from "./contexts/PipelineUiStateContext";
import { useAutoStartSession } from "./hooks/useAutoStartSession";
import { useOpenFile } from "./hooks/useOpenFile";
import { useSavePipelineJson } from "./hooks/useSavePipelineJson";
import { PipelineCanvasHeaderBar } from "./pipeline-canvas-header-bar/PipelineCanvasHeaderBar";
import { PipelineConnection } from "./pipeline-connection/PipelineConnection";
import { PipelineViewport } from "./pipeline-viewport/PipelineViewport";
import { PipelineEditorRoot } from "./PipelineEditorRoot";
import { PipelineStep, STEP_HEIGHT, STEP_WIDTH } from "./PipelineStep";
import { ReadOnlyBanner } from "./ReadOnlyBanner";
import { SaveStatus } from "./SaveStatus";
import { ScheduleJob } from "./schedule-job/ScheduleJob";
import { SelectionRectangle } from "./SelectionRectangle";
import { StepDetails } from "./step-details/StepDetails";
import { StepExecutionState } from "./StepExecutionState";
import { ZoomControls } from "./zoom-controls/ZoomControls";

const localElementPosition = (
  [offsetX, offsetY]: Readonly<Point2D>,
  [parentOffsetX, parentOffsetY]: Readonly<Point2D>,
  scaleFactor: number
): Point2D => [
  (offsetX - parentOffsetX) / scaleFactor,
  (offsetY - parentOffsetY) / scaleFactor,
];

const elementCenter = (
  parentRef: React.MutableRefObject<HTMLDivElement | null>,
  scaleFactor: number
) => (node: HTMLElement): Point2D => {
  const [x, y] = localElementPosition(
    getOffset(node),
    getOffset(parentRef.current),
    scaleFactor
  );

  return [x + node.clientWidth / 2, y + node.clientHeight / 2];
};

export const PipelineEditor = () => {
  const { pipelineCwd, isReadOnly, pipelineJson } = usePipelineDataContext();
  useAutoStartSession();

  const { openNotebook, previewFile } = useOpenFile();

  const { scaleFactor } = useCanvasScaling();
  const {
    pipelineCanvasRef,
    pipelineViewportRef,
    stepRefs,
    newConnection,
    draggedStepPositions,
  } = usePipelineRefs();
  const {
    uiState: {
      stepSelector,
      steps,
      selectedSteps,
      connections,
      grabbedStep,
      selectedConnection,
      openedStep,
      hash,
    },
    uiStateDispatch,
    instantiateConnection,
  } = usePipelineUiStateContext();

  const hasSteps = Object.keys(steps).length;

  const getPosition = React.useMemo(() => {
    return elementCenter(pipelineCanvasRef, scaleFactor);
  }, [pipelineCanvasRef, scaleFactor]);

  useSavePipelineJson();

  const onMouseUpPipelineStep = React.useCallback(
    (endNodeUUID: string) => {
      // finish creating connection
      uiStateDispatch({ type: "MAKE_CONNECTION", payload: endNodeUUID });
    },
    [uiStateDispatch]
  );

  const onDoubleClickStep = (stepUuid: string) => {
    const step = steps[stepUuid];

    if (!step || !pipelineCwd) return;

    if (isReadOnly) {
      previewFile(stepPathToProjectPath(step.file_path, pipelineCwd));
    } else if (pipelineCwd) {
      openNotebook(stepUuid);
    }
  };

  const savePositions = React.useCallback(() => {
    const mutations = draggedStepPositions.current;

    Object.entries(mutations).forEach(([uuid, position]) => {
      uiStateDispatch((state) => ({
        type: "SAVE_STEP_DETAILS",
        payload: {
          uuid,
          stepChanges: {
            meta_data: { position, hidden: state.steps[uuid].meta_data.hidden },
          },
        },
      }));
    });

    draggedStepPositions.current = {};
  }, [draggedStepPositions, uiStateDispatch]);

  const hasSelectedSteps = selectedSteps.length > 0;

  const onSaveDetails = React.useCallback(
    (stepChanges: Partial<StepState>, uuid: string) => {
      if (!isReadOnly) {
        uiStateDispatch({
          type: "SAVE_STEP_DETAILS",
          payload: { stepChanges, uuid },
        });
      }
    },
    [uiStateDispatch, isReadOnly]
  );

  // Check if there is an incoming step (that is not part of the
  // selection).
  // This is checked to conditionally render the
  // 'Run incoming steps' button.
  let selectedStepsHasIncoming = false;
  for (let x = 0; x < selectedSteps.length; x++) {
    const selectedStep = steps[selectedSteps[x]];
    for (let i = 0; i < selectedStep.incoming_connections.length; i++) {
      let incomingStepUUID = selectedStep.incoming_connections[i];
      if (!selectedSteps.includes(incomingStepUUID)) {
        selectedStepsHasIncoming = true;
        break;
      }
    }
    if (selectedStepsHasIncoming) {
      break;
    }
  }

  const flushPage = useHasChanged(hash);

  const [fixedConnections, interactiveConnections] = React.useMemo(() => {
    const nonInteractive: Connection[] = [];
    const interactive: Connection[] = [];
    connections.forEach((connection) => {
      const { startNodeUUID, endNodeUUID } = connection;
      const isInteractive =
        hasValue(grabbedStep) &&
        [startNodeUUID, endNodeUUID].includes(grabbedStep);

      if (isInteractive) {
        interactive.push(connection);
      } else {
        nonInteractive.push(connection);
      }
    });
    return [nonInteractive, interactive];
  }, [connections, grabbedStep, flushPage]); // eslint-disable-line react-hooks/exhaustive-deps

  const closeDetails = React.useCallback(() => {
    uiStateDispatch({ type: "SET_OPENED_STEP", payload: undefined });
  }, [uiStateDispatch]);

  return (
    <PipelineEditorRoot>
      <PipelineViewport ref={pipelineViewportRef}>
        {fixedConnections.map((connection) => {
          const { startNodeUUID, endNodeUUID } = connection;
          // user is trying to make a new connection
          const isNew =
            !hasValue(endNodeUUID) && hasValue(newConnection.current);

          // if the connection is attached to a selected step,
          // the connection should update its start/end node, to move along with the step
          const shouldUpdateStart =
            grabbedStep === startNodeUUID ||
            (selectedSteps.includes(startNodeUUID) &&
              selectedSteps.includes(grabbedStep || ""));

          const shouldUpdateEnd =
            grabbedStep === endNodeUUID ||
            isNew ||
            (selectedSteps.includes(endNodeUUID || "") &&
              selectedSteps.includes(grabbedStep || ""));

          const shouldUpdate = [shouldUpdateStart, shouldUpdateEnd] as const;

          const startPoint: Point2D = [
            steps[startNodeUUID].meta_data.position[0] + STEP_WIDTH,
            steps[startNodeUUID].meta_data.position[1] + STEP_HEIGHT / 2,
          ];

          const endPoint: Point2D | undefined = hasValue(endNodeUUID)
            ? [
                steps[endNodeUUID].meta_data.position[0],
                steps[endNodeUUID].meta_data.position[1] + STEP_HEIGHT / 2,
              ]
            : newConnection.current?.end
            ? newConnection.current.end
            : undefined;

          const isSelected =
            !hasSelectedSteps &&
            selectedConnection?.startNodeUUID === startNodeUUID &&
            selectedConnection?.endNodeUUID === endNodeUUID;

          const key = `${startNodeUUID}-${endNodeUUID}-${hash}`;

          return (
            <PipelineConnection
              key={key}
              shouldRedraw={flushPage}
              isNew={isNew}
              selected={isSelected}
              startNodeUUID={startNodeUUID}
              endNodeUUID={endNodeUUID}
              getPosition={getPosition}
              startPoint={startPoint}
              endPoint={endPoint ?? startPoint}
              shouldUpdate={shouldUpdate}
            />
          );
        })}
        {Object.entries(steps).map((entry) => {
          const [uuid, step] = entry;
          const selected = selectedSteps.includes(uuid);

          const isIncomingActive =
            hasValue(selectedConnection) &&
            selectedConnection.endNodeUUID === step.uuid;

          const isOutgoingActive =
            hasValue(selectedConnection) &&
            selectedConnection.startNodeUUID === step.uuid;

          const movedToTop =
            selectedConnection?.startNodeUUID === step.uuid ||
            selectedConnection?.endNodeUUID === step.uuid;

          // only add steps to the component that have been properly
          // initialized
          return (
            <PipelineStep
              key={`${step.uuid}-${hash}`}
              data={step}
              selected={selected}
              savePositions={savePositions}
              movedToTop={movedToTop}
              ref={(el) => (stepRefs.current[step.uuid] = el)}
              isStartNodeOfNewConnection={
                newConnection.current?.startNodeUUID === step.uuid
              }
              interactiveConnections={interactiveConnections}
              onDoubleClick={onDoubleClickStep}
              getPosition={getPosition}
            >
              <ConnectionDot
                incoming
                newConnection={newConnection}
                isReadOnly={isReadOnly}
                ref={(el) => (stepRefs.current[`${step.uuid}-incoming`] = el)}
                active={isIncomingActive}
                endCreateConnection={() => {
                  if (newConnection.current) {
                    onMouseUpPipelineStep(step.uuid);
                  }
                }}
              />
              <StepExecutionState stepUuid={step.uuid} />
              <Stack
                justifyContent="center"
                alignItems="center"
                height="73px"
                borderRadius="8px 8px 0 0"
                sx={{
                  transition: "background-color 340ms 50ms ease-in",
                  backgroundColor: (theme) => theme.palette.background.paper,
                  "&:hover": {
                    backgroundColor: (theme) =>
                      alpha(theme.palette.background.paper, 0.8),
                  },
                }}
              >
                <Typography sx={ellipsis()} color="text.primary">
                  {step.title || "—"}
                </Typography>
                <Typography
                  sx={ellipsis()}
                  variant="body2"
                  color="text.secondary"
                >
                  {step.file_path}
                </Typography>
              </Stack>
              <ConnectionDot
                outgoing
                isReadOnly={isReadOnly}
                newConnection={newConnection}
                ref={(el) => (stepRefs.current[`${step.uuid}-outgoing`] = el)}
                active={isOutgoingActive}
                startCreateConnection={() => {
                  if (!isReadOnly && !newConnection.current) {
                    newConnection.current = {
                      startNodeUUID: step.uuid,
                    };
                    instantiateConnection(step.uuid);
                  }
                }}
              />
            </PipelineStep>
          );
        })}

        {stepSelector.active && hasSteps && (
          <SelectionRectangle
            {...createRect(stepSelector.start, stepSelector.end)}
          />
        )}
      </PipelineViewport>
      <HeadsUpDisplay>
        <Stack flex="0 0 auto" width="100%">
          <PipelineCanvasHeaderBar />
        </Stack>
        <ReadOnlyBanner />
        <Stack marginLeft="auto" flex="1 1 auto">
          <StepDetails
            key={openedStep}
            onSave={onSaveDetails}
            onClose={closeDetails}
          />
          <ScheduleJob />
        </Stack>
        {pipelineJson && (
          <Stack
            spacing={2}
            direction="row"
            alignItems="center"
            sx={{
              position: "absolute",
              top: "auto",
              bottom: 0,
              right: "auto",
              left: 0,
              padding: (theme) => theme.spacing(2.5),
            }}
          >
            <ZoomControls />
            <SaveStatus />
          </Stack>
        )}
      </HeadsUpDisplay>
    </PipelineEditorRoot>
  );
};
