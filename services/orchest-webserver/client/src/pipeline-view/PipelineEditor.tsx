import { HUD } from "@/components/HUD";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useHasChanged } from "@/hooks/useHasChanged";
import { siteMap } from "@/routingConfig";
import type { Connection, StepState } from "@/types";
import { getOffset } from "@/utils/jquery-replacement";
import Stack from "@mui/material/Stack";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { getNodeCenter } from "./common";
import { ConnectionDot } from "./ConnectionDot";
import { usePipelineDataContext } from "./contexts/PipelineDataContext";
import { usePipelineRefs } from "./contexts/PipelineRefsContext";
import { usePipelineUiStateContext } from "./contexts/PipelineUiStateContext";
import { useScaleFactor } from "./contexts/ScaleFactorContext";
import { useOpenFile } from "./hooks/useOpenFile";
import { useSavePipelineJson } from "./hooks/useSavePipelineJson";
import { PipelineCanvasHeaderBar } from "./pipeline-canvas-header-bar/PipelineCanvasHeaderBar";
import { PipelineConnection } from "./pipeline-connection/PipelineConnection";
import { PipelineViewingOptions } from "./pipeline-viewing-options/PipelineViewingOptions";
import { PipelineViewport } from "./pipeline-viewport/PipelineViewport";
import { PipelineEditorRoot } from "./PipelineEditorRoot";
import { PipelineStep, STEP_HEIGHT, STEP_WIDTH } from "./PipelineStep";
import { ReadOnlyBanner } from "./ReadOnlyBanner";
import { getStepSelectorRectangle, Rectangle } from "./Rectangle";
import { SaveStatus } from "./SaveStatus";
import { StepDetails } from "./step-details/StepDetails";
import { StepExecutionState } from "./StepExecutionState";

export const PipelineEditor = () => {
  const { navigateTo } = useCustomRoute();

  const {
    pipelineCwd,
    isReadOnly,
    projectUuid,
    jobUuid,
    pipelineJson,
  } = usePipelineDataContext();

  const returnToJob = React.useCallback(
    (e?: React.MouseEvent) => {
      navigateTo(siteMap.job.path, { query: { projectUuid, jobUuid } }, e);
    },
    [projectUuid, jobUuid, navigateTo]
  );

  const { openNotebook, openFilePreviewView } = useOpenFile();

  const { scaleFactor } = useScaleFactor();
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
      cursorControlledStep,
      selectedConnection,
      openedStep,
      hash,
    },
    uiStateDispatch,
    instantiateConnection,
  } = usePipelineUiStateContext();

  // we need to calculate the canvas offset every time for re-alignment after zoom in/out
  const canvasOffset = getOffset(pipelineCanvasRef.current);

  const getPosition = React.useMemo(() => {
    return getNodeCenter(canvasOffset, scaleFactor);
    // we need to memoize getPosition to prevent potential re-rendering,
    // but we also need real-time canvasOffset for calculation
  }, [JSON.stringify(canvasOffset), scaleFactor]); // eslint-disable-line react-hooks/exhaustive-deps

  useSavePipelineJson();

  const onMouseUpPipelineStep = React.useCallback(
    (endNodeUUID: string) => {
      // finish creating connection
      uiStateDispatch({ type: "MAKE_CONNECTION", payload: endNodeUUID });
    },
    [uiStateDispatch]
  );

  const onDoubleClickStep = (stepUUID: string) => {
    if (isReadOnly) {
      openFilePreviewView(undefined, stepUUID);
    } else if (pipelineCwd) {
      openNotebook(undefined, stepUUID);
    }
  };

  const savePositions = React.useCallback(() => {
    const mutations = draggedStepPositions.current;

    Object.entries(mutations).forEach(([key, position]) => {
      uiStateDispatch((state) => ({
        type: "SAVE_STEP_DETAILS",
        payload: {
          stepChanges: {
            meta_data: { position, hidden: state.steps[key].meta_data.hidden },
          },
          uuid: key,
        },
      }));
    });

    draggedStepPositions.current = {};
  }, [draggedStepPositions, uiStateDispatch]);

  const hasSelectedSteps = selectedSteps.length > 0;

  const onSaveDetails = React.useCallback(
    (stepChanges: Partial<StepState>, uuid: string, replace = false) => {
      uiStateDispatch({
        type: "SAVE_STEP_DETAILS",
        payload: { stepChanges, uuid, replace },
      });
    },
    [uiStateDispatch]
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
        hasValue(cursorControlledStep) &&
        [startNodeUUID, endNodeUUID].includes(cursorControlledStep);

      if (isInteractive) {
        interactive.push(connection);
      } else {
        nonInteractive.push(connection);
      }
    });
    return [nonInteractive, interactive];
  }, [connections, cursorControlledStep, flushPage]); // eslint-disable-line react-hooks/exhaustive-deps

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
            cursorControlledStep === startNodeUUID ||
            (selectedSteps.includes(startNodeUUID) &&
              selectedSteps.includes(cursorControlledStep || ""));

          const shouldUpdateEnd =
            cursorControlledStep === endNodeUUID ||
            isNew ||
            (selectedSteps.includes(endNodeUUID || "") &&
              selectedSteps.includes(cursorControlledStep || ""));

          const shouldUpdate = [shouldUpdateStart, shouldUpdateEnd] as const;

          const startNodePosition = {
            x: steps[startNodeUUID].meta_data.position[0] + STEP_WIDTH,
            y: steps[startNodeUUID].meta_data.position[1] + STEP_HEIGHT / 2,
          };

          const endNodePosition = hasValue(endNodeUUID)
            ? {
                x: steps[endNodeUUID].meta_data.position[0],
                y: steps[endNodeUUID].meta_data.position[1] + STEP_HEIGHT / 2,
              }
            : newConnection.current
            ? {
                x: newConnection.current.xEnd,
                y: newConnection.current.yEnd,
              }
            : null;

          const isSelected =
            !hasSelectedSteps &&
            selectedConnection?.startNodeUUID === startNodeUUID &&
            selectedConnection?.endNodeUUID === endNodeUUID;

          const key = `${startNodeUUID}-${endNodeUUID}-${hash}`;

          return (
            startNodePosition && (
              <PipelineConnection
                key={key}
                shouldRedraw={flushPage}
                isNew={isNew}
                selected={isSelected}
                startNodeUUID={startNodeUUID}
                endNodeUUID={endNodeUUID}
                getPosition={getPosition}
                startNodeX={startNodePosition.x}
                startNodeY={startNodePosition.y}
                endNodeX={endNodePosition?.x}
                endNodeY={endNodePosition?.y}
                shouldUpdate={shouldUpdate}
              />
            )
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
              <div className="step-label-holder">
                <div className={"step-label"}>
                  {step.title}
                  <span className="filename">{step.file_path}</span>
                </div>
              </div>
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

        {stepSelector.active && (
          <Rectangle {...getStepSelectorRectangle(stepSelector)} />
        )}
      </PipelineViewport>
      <HUD>
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
            <PipelineViewingOptions />
            <SaveStatus />
          </Stack>
        )}
      </HUD>
    </PipelineEditorRoot>
  );
};
