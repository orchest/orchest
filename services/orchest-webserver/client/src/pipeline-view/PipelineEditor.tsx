import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useHasChanged } from "@/hooks/useHasChanged";
import { siteMap } from "@/routingConfig";
import type { Connection, Step } from "@/types";
import { getOffset } from "@/utils/jquery-replacement";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { getNodeCenter } from "./common";
import { ConnectionDot } from "./ConnectionDot";
import { usePipelineDataContext } from "./contexts/PipelineDataContext";
import { usePipelineRefs } from "./contexts/PipelineRefsContext";
import { usePipelineUiStateContext } from "./contexts/PipelineUiStateContext";
import { useScaleFactor } from "./contexts/ScaleFactorContext";
import { DeleteStepsButton } from "./DeleteStepsButton";
import { useInitializeConnections } from "./hooks/useInitializeConnections";
import { useOpenFile } from "./hooks/useOpenFile";
import { useSavePipelineJson } from "./hooks/useSavePipelineJson";
import { HotKeysBoundary } from "./HotKeysBoundary";
import { PipelineCanvasHeaderBar } from "./pipeline-canvas-header-bar/PipelineCanvasHeaderBar";
import { PipelineConnection } from "./pipeline-connection/PipelineConnection";
import { PipelineViewingOptions } from "./pipeline-viewing-opions/PipelineViewingOptions";
import { PipelineViewport } from "./pipeline-viewport/PipelineViewport";
import { SnapshotBanner } from "./PipelineBanner";
import { PipelineStep } from "./PipelineStep";
import { getStepSelectorRectangle, Rectangle } from "./Rectangle";
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
    },
    uiStateDispatch,
    instantiateConnection,
    recalibrate,
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
    recalibrate();
  }, [draggedStepPositions, recalibrate, uiStateDispatch]);

  const hasSelectedSteps = selectedSteps.length > 0;

  const onSaveDetails = React.useCallback(
    (stepChanges: Partial<Step>, uuid: string, replace = false) => {
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

  const { hash = "" } = pipelineJson || {};

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
  }, [connections, cursorControlledStep]);

  useInitializeConnections();

  return (
    <div className="pipeline-view">
      <HotKeysBoundary>
        <PipelineCanvasHeaderBar />
        <PipelineViewport ref={pipelineViewportRef}>
          {fixedConnections.map((connection) => {
            const { startNodeUUID, endNodeUUID } = connection;
            const startNode = stepRefs.current[`${startNodeUUID}-outgoing`];
            const endNode = endNodeUUID
              ? stepRefs.current[`${endNodeUUID}-incoming`]
              : undefined;

            // startNode is required
            if (!startNode) return null;

            // user is trying to make a new connection
            const isNew = !endNodeUUID && hasValue(newConnection.current);

            // if the connection is attached to a selected step,
            // the connection should update its start/end node, to move along with the step
            const shouldUpdateStart =
              flushPage ||
              cursorControlledStep === startNodeUUID ||
              (selectedSteps.includes(startNodeUUID) &&
                selectedSteps.includes(cursorControlledStep || ""));

            const shouldUpdateEnd =
              flushPage ||
              cursorControlledStep === endNodeUUID ||
              isNew ||
              (selectedSteps.includes(endNodeUUID || "") &&
                selectedSteps.includes(cursorControlledStep || ""));

            const shouldUpdate = [shouldUpdateStart, shouldUpdateEnd] as const;

            const startNodePosition = getPosition(startNode);

            const endNodePosition =
              getPosition(endNode) ||
              (newConnection.current
                ? {
                    x: newConnection.current.xEnd,
                    y: newConnection.current.yEnd,
                  }
                : null);

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
        {jobUuid && isReadOnly && (
          <div className="pipeline-actions top-left">
            <SnapshotBanner />
          </div>
        )}
        {pipelineJson && (
          <div className="pipeline-actions bottom-left">
            <PipelineViewingOptions />
          </div>
        )}
      </HotKeysBoundary>
      <StepDetails key={openedStep} onSave={onSaveDetails} />
      {hasSelectedSteps && !isReadOnly && (
        <div className={"pipeline-actions bottom-right"}>
          <DeleteStepsButton />
        </div>
      )}
    </div>
  );
};
