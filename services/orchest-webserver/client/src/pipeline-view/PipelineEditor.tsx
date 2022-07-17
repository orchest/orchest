import { IconButton } from "@/components/common/IconButton";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useHasChanged } from "@/hooks/useHasChanged";
import { siteMap } from "@/routingConfig";
import type { Connection, Step } from "@/types";
import { getOffset } from "@/utils/jquery-replacement";
import { join } from "@/utils/path";
import { layoutPipeline } from "@/utils/pipeline-layout";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import AddIcon from "@mui/icons-material/Add";
import CropFreeIcon from "@mui/icons-material/CropFree";
import RemoveIcon from "@mui/icons-material/Remove";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { BackToJobButton } from "./BackToJobButton";
import { getNodeCenter, SCALE_UNIT, updatePipelineJson } from "./common";
import { ConnectionDot } from "./ConnectionDot";
import { usePipelineCanvasContext } from "./contexts/PipelineCanvasContext";
import { usePipelineDataContext } from "./contexts/PipelineDataContext";
import { usePipelineEditorContext } from "./contexts/PipelineEditorContext";
import { usePipelineRefs } from "./contexts/PipelineRefsContext";
import { usePipelineUiStatesContext } from "./contexts/PipelineUiStatesContext";
import { useScaleFactor } from "./contexts/ScaleFactorContext";
import { DeleteStepsButton } from "./DeleteStepsButton";
import { useOpenFile } from "./hooks/useOpenFile";
import { useSavePipelineJson } from "./hooks/useSavePipelineJson";
import { HotKeysBoundary } from "./HotKeysBoundary";
import { PipelineCanvasHeaderBar } from "./pipeline-canvas-header-bar/PipelineCanvasHeaderBar";
import { PipelineConnection } from "./pipeline-connection/PipelineConnection";
import { PipelineViewport } from "./pipeline-viewport/PipelineViewport";
import { PipelineStep, STEP_HEIGHT, STEP_WIDTH } from "./PipelineStep";
import { getStepSelectorRectangle, Rectangle } from "./Rectangle";
import { StepDetails } from "./step-details/StepDetails";
import { StepExecutionState } from "./StepExecutionState";

export const PipelineEditor = () => {
  const { navigateTo } = useCustomRoute();

  const {
    pipelineCwd,
    runUuid,
    isReadOnly,
    projectUuid,
    pipelineUuid,
    jobUuid,
  } = usePipelineDataContext();

  const returnToJob = React.useCallback(
    (e?: React.MouseEvent) => {
      navigateTo(siteMap.job.path, { query: { projectUuid, jobUuid } }, e);
    },
    [projectUuid, jobUuid, navigateTo]
  );

  const {
    eventVars,
    dispatch,
    stepDomRefs,
    newConnection,
    pipelineJson,
    setPipelineJson,
    hash,
    zIndexMax,
    instantiateConnection,
    metadataPositions,
  } = usePipelineEditorContext();

  const { centerPipelineOrigin, centerView } = usePipelineCanvasContext();

  const { openNotebook, openFilePreviewView } = useOpenFile();

  const isJobRun = jobUuid && runUuid;
  const jobRunQueryArgs = React.useMemo(() => ({ jobUuid, runUuid }), [
    jobUuid,
    runUuid,
  ]);

  const { scaleFactor, setScaleFactor } = useScaleFactor();
  const { pipelineCanvasRef, pipelineViewportRef } = usePipelineRefs();
  const {
    uiStates: { stepSelector },
  } = usePipelineUiStatesContext();

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
      dispatch({ type: "MAKE_CONNECTION", payload: endNodeUUID });
    },
    [dispatch]
  );

  const openLogs = (e: React.MouseEvent) => {
    navigateTo(
      isJobRun ? siteMap.jobRunLogs.path : siteMap.logs.path,
      {
        query: {
          projectUuid,
          pipelineUuid,
          ...(isJobRun ? jobRunQueryArgs : undefined),
        },
        state: { isReadOnly },
      },
      e
    );
  };

  const onDoubleClickStep = (stepUUID: string) => {
    if (isReadOnly) {
      openFilePreviewView(undefined, stepUUID);
    } else if (pipelineCwd) {
      openNotebook(undefined, stepUUID);
    }
  };

  const recalibrate = React.useCallback(() => {
    // ensure that connections are re-rendered against the final positions of the steps
    setPipelineJson((value) => value, true);
  }, [setPipelineJson]);

  const autoLayoutPipeline = () => {
    const spacingFactor = 0.7;
    const gridMargin = 20;

    setPipelineJson((current) => {
      if (!current) return current;
      const updatedSteps = layoutPipeline(
        // Use the pipeline definition from the editor
        eventVars.steps,
        STEP_HEIGHT,
        (1 + spacingFactor * (STEP_HEIGHT / STEP_WIDTH)) *
          (STEP_WIDTH / STEP_HEIGHT),
        1 + spacingFactor,
        gridMargin,
        gridMargin * 4, // don't put steps behind top buttons
        gridMargin,
        STEP_HEIGHT
      );

      const updated = updatePipelineJson(current, updatedSteps);

      // Save `eventVars.steps`.
      dispatch({ type: "SAVE_STEPS", payload: updated.steps });
      return updated;
    }, true); // flush page, re-instantiate all UI elements with new local state for dragging
    // the rendering of connection lines depend on the positions of the steps
    // so we need another render to redraw the connections lines
    // here we intentionally break the React built-in event batching
    window.setTimeout(() => {
      recalibrate();
    }, 0);
  };

  const savePositions = React.useCallback(() => {
    const mutations = metadataPositions.current;

    Object.entries(mutations).forEach(([key, position]) => {
      dispatch((state) => ({
        type: "SAVE_STEP_DETAILS",
        payload: {
          stepChanges: {
            meta_data: { position, hidden: state.steps[key].meta_data.hidden },
          },
          uuid: key,
        },
      }));
    });

    metadataPositions.current = {};
    recalibrate();
  }, [metadataPositions, recalibrate, dispatch]);

  const hasSelectedSteps = eventVars.selectedSteps.length > 0;

  const onSaveDetails = React.useCallback(
    (stepChanges: Partial<Step>, uuid: string, replace = false) => {
      dispatch({
        type: "SAVE_STEP_DETAILS",
        payload: { stepChanges, uuid, replace },
      });
    },
    [dispatch]
  );

  // Check if there is an incoming step (that is not part of the
  // selection).
  // This is checked to conditionally render the
  // 'Run incoming steps' button.
  let selectedStepsHasIncoming = false;
  for (let x = 0; x < eventVars.selectedSteps.length; x++) {
    const selectedStep = eventVars.steps[eventVars.selectedSteps[x]];
    for (let i = 0; i < selectedStep.incoming_connections.length; i++) {
      let incomingStepUUID = selectedStep.incoming_connections[i];
      if (!eventVars.selectedSteps.includes(incomingStepUUID)) {
        selectedStepsHasIncoming = true;
        break;
      }
    }
    if (selectedStepsHasIncoming) {
      break;
    }
  }

  const flushPage = useHasChanged(hash.current);

  const [connections, interactiveConnections] = React.useMemo(() => {
    const nonInteractive: Connection[] = [];
    const interactive: Connection[] = [];
    eventVars.connections.forEach((connection) => {
      const { startNodeUUID, endNodeUUID } = connection;
      const isInteractive =
        hasValue(eventVars.cursorControlledStep) &&
        [startNodeUUID, endNodeUUID].includes(eventVars.cursorControlledStep);

      if (isInteractive) {
        interactive.push(connection);
      } else {
        nonInteractive.push(connection);
      }
    });
    return [nonInteractive, interactive];
  }, [eventVars.connections, eventVars.cursorControlledStep]);

  return (
    <div className="pipeline-view">
      <HotKeysBoundary>
        {jobUuid && isReadOnly && (
          <div className="pipeline-actions top-left">
            <BackToJobButton onClick={returnToJob} />
          </div>
        )}
        <PipelineCanvasHeaderBar />
        <PipelineViewport
          ref={pipelineViewportRef}
          autoLayoutPipeline={autoLayoutPipeline}
        >
          {connections.map((connection) => {
            const { startNodeUUID, endNodeUUID } = connection;
            const startNode = stepDomRefs.current[`${startNodeUUID}-outgoing`];
            const endNode = endNodeUUID
              ? stepDomRefs.current[`${endNodeUUID}-incoming`]
              : undefined;

            // startNode is required
            if (!startNode) return null;

            // user is trying to make a new connection
            const isNew = !endNodeUUID && hasValue(newConnection.current);

            // if the connection is attached to a selected step,
            // the connection should update its start/end node, to move along with the step
            const shouldUpdateStart =
              flushPage ||
              eventVars.cursorControlledStep === startNodeUUID ||
              (eventVars.selectedSteps.includes(startNodeUUID) &&
                eventVars.selectedSteps.includes(
                  eventVars.cursorControlledStep || ""
                ));

            const shouldUpdateEnd =
              flushPage ||
              eventVars.cursorControlledStep === endNodeUUID ||
              isNew ||
              (eventVars.selectedSteps.includes(endNodeUUID || "") &&
                eventVars.selectedSteps.includes(
                  eventVars.cursorControlledStep || ""
                ));

            const shouldUpdate = [shouldUpdateStart, shouldUpdateEnd] as [
              boolean,
              boolean
            ];

            let startNodePosition = getPosition(startNode);

            let endNodePosition =
              getPosition(endNode) ||
              (newConnection.current
                ? {
                    x: newConnection.current.xEnd,
                    y: newConnection.current.yEnd,
                  }
                : null);

            const isSelected =
              !hasSelectedSteps &&
              eventVars.selectedConnection?.startNodeUUID === startNodeUUID &&
              eventVars.selectedConnection?.endNodeUUID === endNodeUUID;

            const key = `${startNodeUUID}-${endNodeUUID}-${hash.current}`;

            return (
              startNodePosition && (
                <PipelineConnection
                  key={key}
                  shouldRedraw={flushPage}
                  isNew={isNew}
                  selected={isSelected}
                  startNodeUUID={startNodeUUID}
                  endNodeUUID={endNodeUUID}
                  zIndexMax={zIndexMax}
                  getPosition={getPosition}
                  eventVarsDispatch={dispatch}
                  stepDomRefs={stepDomRefs}
                  startNodeX={startNodePosition.x}
                  startNodeY={startNodePosition.y}
                  endNodeX={endNodePosition?.x}
                  endNodeY={endNodePosition?.y}
                  newConnection={newConnection}
                  shouldUpdate={shouldUpdate}
                  cursorControlledStep={eventVars.cursorControlledStep}
                />
              )
            );
          })}
          {Object.entries(eventVars.steps).map((entry) => {
            const [uuid, step] = entry;
            const selected = eventVars.selectedSteps.includes(uuid);

            const isIncomingActive =
              hasValue(eventVars.selectedConnection) &&
              eventVars.selectedConnection.endNodeUUID === step.uuid;

            const isOutgoingActive =
              hasValue(eventVars.selectedConnection) &&
              eventVars.selectedConnection.startNodeUUID === step.uuid;

            const movedToTop =
              eventVars.selectedConnection?.startNodeUUID === step.uuid ||
              eventVars.selectedConnection?.endNodeUUID === step.uuid;

            // only add steps to the component that have been properly
            // initialized
            return (
              <PipelineStep
                key={`${step.uuid}-${hash.current}`}
                data={step}
                selected={selected}
                savePositions={savePositions}
                movedToTop={movedToTop}
                ref={(el) => (stepDomRefs.current[step.uuid] = el)}
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
                  ref={(el) =>
                    (stepDomRefs.current[`${step.uuid}-incoming`] = el)
                  }
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
                  ref={(el) =>
                    (stepDomRefs.current[`${step.uuid}-outgoing`] = el)
                  }
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
        {pipelineJson && (
          <div className="pipeline-actions bottom-left">
            <div className="navigation-buttons">
              <IconButton
                title="Center"
                data-test-id="pipeline-center"
                onPointerDown={centerView}
              >
                <CropFreeIcon />
              </IconButton>
              <IconButton
                title="Zoom out"
                onPointerDown={() => {
                  // NOTE: onClick also listens to space bar press when button is focused
                  // it causes issue when user press space bar to navigate the canvas
                  // thus, onPointerDown should be used here, so zoom-out only is triggered if user mouse down on the button
                  centerPipelineOrigin();
                  setScaleFactor((current) => current - SCALE_UNIT);
                }}
              >
                <RemoveIcon />
              </IconButton>
              <IconButton
                title="Zoom in"
                onPointerDown={() => {
                  centerPipelineOrigin();
                  setScaleFactor((current) => current + SCALE_UNIT);
                }}
              >
                <AddIcon />
              </IconButton>
              {!isReadOnly && (
                <IconButton
                  title="Auto layout"
                  onPointerDown={autoLayoutPipeline}
                >
                  <AccountTreeOutlinedIcon />
                </IconButton>
              )}
            </div>
          </div>
        )}
      </HotKeysBoundary>
      <StepDetails key={eventVars.openedStep} onSave={onSaveDetails} />
      {hasSelectedSteps && !isReadOnly && (
        <div className={"pipeline-actions bottom-right"}>
          <DeleteStepsButton />
        </div>
      )}
    </div>
  );
};
