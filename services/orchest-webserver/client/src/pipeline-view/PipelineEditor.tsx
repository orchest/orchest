import { IconButton } from "@/components/common/IconButton";
import { useAppContext } from "@/contexts/AppContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useHasChanged } from "@/hooks/useHasChanged";
import { useHotKeys } from "@/hooks/useHotKeys";
import { siteMap } from "@/routingConfig";
import type { Connection, PipelineJson, Step, StepsDict } from "@/types";
import { getOffset } from "@/utils/jquery-replacement";
import { layoutPipeline } from "@/utils/pipeline-layout";
import { resolve } from "@/utils/resolve";
import { filterServices, validatePipeline } from "@/utils/webserver-utils";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import CropFreeIcon from "@mui/icons-material/CropFree";
import DeleteIcon from "@mui/icons-material/Delete";
import RemoveIcon from "@mui/icons-material/Remove";
import SettingsIcon from "@mui/icons-material/Settings";
import TuneIcon from "@mui/icons-material/Tune";
import ViewHeadlineIcon from "@mui/icons-material/ViewHeadline";
import VisibilityIcon from "@mui/icons-material/Visibility";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import {
  activeElementIsInput,
  fetcher,
  hasValue,
  joinRelativePaths,
} from "@orchest/lib-utils";
import React from "react";
import { BackToJobButton } from "./BackToJobButton";
import {
  getNodeCenter,
  PIPELINE_RUN_STATUS_ENDPOINT,
  updatePipelineJson,
} from "./common";
import { ConnectionDot } from "./ConnectionDot";
import { usePipelineEditorContext } from "./contexts/PipelineEditorContext";
import { CreateNextStepButton } from "./CreateNextStepButton";
import { RunStepsType, useInteractiveRuns } from "./hooks/useInteractiveRuns";
import { useOpenNoteBook } from "./hooks/useOpenNoteBook";
import { useSavingIndicator } from "./hooks/useSavingIndicator";
import { PipelineConnection } from "./pipeline-connection/PipelineConnection";
import {
  CanvasFunctions,
  PipelineViewport,
} from "./pipeline-viewport/PipelineViewport";
import { PipelineActionButton } from "./PipelineActionButton";
import {
  ExecutionState,
  getStateText,
  PipelineStep,
  StepStatus,
  STEP_HEIGHT,
  STEP_WIDTH,
} from "./PipelineStep";
import { getStepSelectorRectangle, Rectangle } from "./Rectangle";
import { ServicesMenu } from "./ServicesMenu";
import { StepDetails } from "./step-details/StepDetails";

const deleteStepMessage =
  "A deleted step and its logs cannot be recovered once deleted, are you sure you want to proceed?";

export const PipelineEditor = () => {
  const { setAlert, setConfirm } = useAppContext();

  const { projectUuid, pipelineUuid, jobUuid, navigateTo } = useCustomRoute();

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
    pipelineCanvasRef,
    newConnection,
    pipelineCwd,
    pipelineJson,
    setPipelineJson,
    hash,
    fetchDataError,
    runUuid,
    zIndexMax,
    isReadOnly,
    instantiateConnection,
    metadataPositions,
    session,
  } = usePipelineEditorContext();

  const openNotebook = useOpenNoteBook();

  const removeSteps = React.useCallback(
    (uuids: string[]) => {
      dispatch({ type: "REMOVE_STEPS", payload: uuids });
    },
    [dispatch]
  );

  const isJobRun = jobUuid && runUuid;
  const jobRunQueryArgs = React.useMemo(() => ({ jobUuid, runUuid }), [
    jobUuid,
    runUuid,
  ]);

  const pipelineViewportRef = React.useRef<HTMLDivElement | null>(null);
  const canvasFuncRef = React.useRef<CanvasFunctions>();

  // we need to calculate the canvas offset every time for re-alignment after zoom in/out
  const canvasOffset = getOffset(pipelineCanvasRef.current);

  const getPosition = React.useMemo(() => {
    return getNodeCenter(canvasOffset, eventVars.scaleFactor);
    // we need to memoize getPosition to prevent potential re-rendering,
    // but we also need real-time canvasOffset for calculation
  }, [JSON.stringify(canvasOffset), eventVars.scaleFactor]); // eslint-disable-line react-hooks/exhaustive-deps

  const [isHoverEditor, setIsHoverEditor] = React.useState(false);
  const { setScope } = useHotKeys(
    {
      "pipeline-editor": {
        "ctrl+a, command+a, ctrl+enter, command+enter": (e, hotKeyEvent) => {
          if (["ctrl+a", "command+a"].includes(hotKeyEvent.key)) {
            e.preventDefault();

            dispatch({
              type: "SELECT_STEPS",
              payload: { uuids: Object.keys(eventVars.steps) },
            });
          }
          if (["ctrl+enter", "command+enter"].includes(hotKeyEvent.key))
            runSelectedSteps();
        },
      },
    },
    [isHoverEditor, eventVars.steps, eventVars.selectedSteps],
    isHoverEditor
  );

  const [isDeletingSteps, setIsDeletingSteps] = React.useState(false);

  const {
    stepExecutionState,
    pipelineRunning,
    isCancellingRun,
    setIsCancellingRun,
    executeRun,
  } = useInteractiveRuns();

  React.useEffect(() => {
    // This case is hit when a user tries to load a pipeline that belongs
    // to a run that has not started yet. The project files are only
    // copied when the run starts. Before start, the pipeline.json thus
    // cannot be found. Alert the user about missing pipeline and return
    // to JobView.
    if (fetchDataError)
      setAlert(
        "Error",
        jobUuid
          ? "The .orchest pipeline file could not be found. This pipeline run has not been started. Returning to Job view."
          : "Could not load pipeline",
        (resolve) => {
          resolve(true);
          if (jobUuid) {
            returnToJob();
          } else {
            navigateTo(siteMap.pipeline.path, { query: { projectUuid } });
          }

          return true;
        }
      );
  }, [fetchDataError, returnToJob, setAlert, navigateTo, projectUuid, jobUuid]);

  const setOngoingSaves = useSavingIndicator();

  const savePipelineJson = React.useCallback(
    async (data: PipelineJson) => {
      if (!data || isReadOnly) return;
      setOngoingSaves((current) => current + 1);

      let formData = new FormData();
      formData.append("pipeline_json", JSON.stringify(data));
      const response = await resolve(() =>
        fetcher(`/async/pipelines/json/${projectUuid}/${pipelineUuid}`, {
          method: "POST",
          body: formData,
        })
      );

      if (response.status === "rejected") {
        // currently step details doesn't do form field validation properly
        // don't apply setAlert here before the form validation is implemented
        console.error(`Failed to save pipeline. ${response.error.message}`);
      }

      setOngoingSaves((current) => current - 1);
    },
    [isReadOnly, projectUuid, pipelineUuid, setOngoingSaves]
  );

  const mergeStepsIntoPipelineJson = React.useCallback(
    (steps?: StepsDict) => {
      if (!pipelineJson) return;
      if (isReadOnly) {
        console.error("savePipeline should be uncallable in readOnly mode.");
        return;
      }

      const updatedPipelineJson = steps
        ? updatePipelineJson(pipelineJson, steps)
        : pipelineJson;

      // validate pipelineJSON
      let pipelineValidation = validatePipeline(updatedPipelineJson);

      if (!pipelineValidation.valid) {
        // Just show the first error
        setAlert("Error", pipelineValidation.errors[0]);
        return;
      }

      setPipelineJson(updatedPipelineJson);

      return updatedPipelineJson;
    },
    [isReadOnly, setAlert, pipelineJson, setPipelineJson]
  );

  const onMouseUpPipelineStep = React.useCallback(
    (endNodeUUID: string) => {
      // finish creating connection
      dispatch({ type: "MAKE_CONNECTION", payload: endNodeUUID });
    },
    [dispatch]
  );

  const saveSteps = React.useCallback(
    (steps: StepsDict) => {
      const newPipelineJson = mergeStepsIntoPipelineJson(steps);
      if (newPipelineJson) savePipelineJson(newPipelineJson);
    },
    [mergeStepsIntoPipelineJson, savePipelineJson]
  );

  const openSettings = (e: React.MouseEvent) => {
    navigateTo(
      isJobRun
        ? siteMap.jobRunPipelineSettings.path
        : siteMap.pipelineSettings.path,
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

  const onOpenFilePreviewView = React.useCallback(
    (e: React.MouseEvent | undefined, stepUuid: string) => {
      navigateTo(
        isJobRun ? siteMap.jobRunFilePreview.path : siteMap.filePreview.path,
        {
          query: {
            projectUuid,
            pipelineUuid,
            stepUuid,
            ...(isJobRun ? jobRunQueryArgs : undefined),
          },
          state: { isReadOnly },
        },
        e
      );
    },
    [
      isJobRun,
      isReadOnly,
      jobRunQueryArgs,
      navigateTo,
      pipelineUuid,
      projectUuid,
    ]
  );

  const notebookFilePath = React.useCallback(
    (pipelineCwd: string, stepUUID: string) => {
      return joinRelativePaths(
        pipelineCwd,
        eventVars.steps[stepUUID].file_path
      );
    },
    [eventVars.steps]
  );

  const [isShowingServices, setIsShowingServices] = React.useState(false);

  const showServices = () => {
    setIsShowingServices(true);
  };

  const hideServices = () => {
    setIsShowingServices(false);
  };

  const onDoubleClickStep = (stepUUID: string) => {
    if (isReadOnly) {
      onOpenFilePreviewView(undefined, stepUUID);
    } else if (pipelineCwd) {
      openNotebook(undefined, notebookFilePath(pipelineCwd, stepUUID));
    }
  };

  const deleteSelectedSteps = React.useCallback(() => {
    // The if is to avoid the dialog appearing when no steps are
    // selected and the delete button is pressed.
    if (eventVars.selectedSteps.length > 0) {
      setIsDeletingSteps(true);

      setConfirm("Warning", deleteStepMessage, {
        onConfirm: async (resolve) => {
          dispatch({ type: "SET_OPENED_STEP", payload: undefined });
          removeSteps([...eventVars.selectedSteps]);
          setIsDeletingSteps(false);
          saveSteps(eventVars.steps);
          resolve(true);
          return true;
        },
        onCancel: (resolve) => {
          setIsDeletingSteps(false);
          resolve(false);
          return false;
        },
      });
    }
  }, [
    dispatch,
    eventVars.selectedSteps,
    eventVars.steps,
    removeSteps,
    saveSteps,
    setConfirm,
  ]);

  const onDetailsDelete = React.useCallback(() => {
    setConfirm("Warning", deleteStepMessage, async (resolve) => {
      if (!eventVars.openedStep) {
        resolve(false);
        return false;
      }
      removeSteps([eventVars.openedStep]);
      saveSteps(eventVars.steps);
      resolve(true);
      return true;
    });
  }, [
    eventVars.openedStep,
    eventVars.steps,
    removeSteps,
    saveSteps,
    setConfirm,
  ]);

  const onOpenNotebook = React.useCallback(
    (e: React.MouseEvent) => {
      if (pipelineCwd && eventVars.openedStep)
        openNotebook(e, notebookFilePath(pipelineCwd, eventVars.openedStep));
    },
    [eventVars.openedStep, notebookFilePath, openNotebook, pipelineCwd]
  );

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

      // reset eventVars.steps, this will trigger saving
      dispatch({ type: "SET_STEPS", payload: updated.steps });
      saveSteps(updated.steps); // normally SET_STEPS won't trigger save
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

  const runSelectedSteps = () => {
    runStepUUIDs(eventVars.selectedSteps, "selection");
  };
  const onRunIncoming = () => {
    runStepUUIDs(eventVars.selectedSteps, "incoming");
  };

  const cancelRun = async () => {
    if (isJobRun) {
      setConfirm(
        "Warning",
        "Are you sure that you want to cancel this job run?",
        async (resolve) => {
          setIsCancellingRun(true);
          try {
            await fetcher(`/catch/api-proxy/api/jobs/${jobUuid}/${runUuid}`, {
              method: "DELETE",
            });
            resolve(true);
          } catch (error) {
            setAlert("Error", `Failed to cancel this job run.`);
            resolve(false);
          }
          setIsCancellingRun(false);
          return true;
        }
      );
      return;
    }

    if (!pipelineRunning) {
      setAlert("Error", "There is no pipeline running.");
      return;
    }

    try {
      setIsCancellingRun(true);
      await fetcher(`${PIPELINE_RUN_STATUS_ENDPOINT}/${runUuid}`, {
        method: "DELETE",
      });
      setIsCancellingRun(false);
    } catch (error) {
      setAlert("Error", `Could not cancel pipeline run for runUuid ${runUuid}`);
    }
  };

  const runStepUUIDs = (uuids: string[], type: RunStepsType) => {
    if (!session || session.status !== "RUNNING") {
      setAlert(
        "Error",
        "There is no active session. Please start the session first."
      );
      return;
    }

    saveSteps(eventVars.steps);
    executeRun(uuids, type);
  };

  const hasSelectedSteps = eventVars.selectedSteps.length > 1;

  const onSaveDetails = React.useCallback(
    (stepChanges: Partial<Step>, uuid: string, replace = false) => {
      dispatch({
        type: "SAVE_STEP_DETAILS",
        payload: { stepChanges, uuid, replace },
      });
    },
    [dispatch]
  );

  const enableHotKeys = () => {
    setScope("pipeline-editor");
    setIsHoverEditor(true);
  };

  const disableHotKeys = () => {
    setIsHoverEditor(false);
  };

  React.useEffect(() => {
    disableHotKeys();
    return () => disableHotKeys();
  }, []);

  React.useEffect(() => {
    const keyDownHandler = (event: KeyboardEvent) => {
      if (activeElementIsInput()) return;
      if (eventVars.stepSelector.active) {
        dispatch({ type: "SET_STEP_SELECTOR_INACTIVE" });
      }

      if (
        !isReadOnly &&
        (event.key === "Backspace" || event.key === "Delete")
      ) {
        if (eventVars.selectedSteps.length > 0) deleteSelectedSteps();
        if (eventVars.selectedConnection)
          dispatch({
            type: "REMOVE_CONNECTION",
            payload: eventVars.selectedConnection,
          });
      }
    };

    document.body.addEventListener("keydown", keyDownHandler);

    return () => {
      document.body.removeEventListener("keydown", keyDownHandler);
    };
  }, [
    dispatch,
    isReadOnly,
    eventVars.selectedConnection,
    eventVars.selectedSteps,
    eventVars.stepSelector.active,
    deleteSelectedSteps,
  ]);

  const services = React.useMemo(() => {
    // not a job run, so it is an interactive run, services are only available if session is RUNNING
    if (!isJobRun && session?.status !== "RUNNING") return null;
    // it is a job run (non-interactive run), we are unable to check its actual session
    // but we can check its job run status,
    if (isJobRun && pipelineJson && !pipelineRunning) return null;
    const allServices = isJobRun
      ? pipelineJson?.services || {}
      : session && session.user_services
      ? session.user_services
      : {};
    // Filter services based on scope

    return filterServices(
      allServices,
      jobUuid ? "noninteractive" : "interactive"
    );
  }, [pipelineJson, session, jobUuid, isJobRun, pipelineRunning]);

  // Check if there is an incoming step (that is not part of the
  // selection).
  // This is checked to conditionally render the
  // 'Run incoming steps' button.
  let selectedStepsHasIncoming = false;
  for (let x = 0; x < eventVars.selectedSteps.length; x++) {
    let selectedStep = eventVars.steps[eventVars.selectedSteps[x]];
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

  const servicesButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const flushPage = useHasChanged(hash.current);
  const shouldSave = useHasChanged(eventVars.timestamp);

  // if timestamp is changed, auto-save
  // check useEventVars to see if the action return value is wrapped by withTimestamp
  React.useEffect(() => {
    if (hasValue(eventVars.timestamp) && shouldSave) {
      saveSteps(eventVars.steps);
    }
  }, [saveSteps, eventVars.timestamp, eventVars.steps, shouldSave]);

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
      <div
        className="pane pipeline-view-pane"
        onMouseOver={enableHotKeys}
        onMouseLeave={disableHotKeys}
      >
        {jobUuid && isReadOnly && (
          <div className="pipeline-actions top-left">
            <BackToJobButton onClick={returnToJob} />
          </div>
        )}
        <PipelineViewport
          ref={pipelineViewportRef}
          canvasFuncRef={canvasFuncRef}
        >
          {connections.map((connection) => {
            if (!connection) return null;

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

            const executionState = stepExecutionState
              ? stepExecutionState[step.uuid] || { status: "IDLE" }
              : { status: "IDLE" };

            const stateText = getStateText(executionState as ExecutionState);

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
                <Box className={"execution-indicator"}>
                  <StepStatus value={executionState.status} />
                  {stateText}
                </Box>
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
          {eventVars.stepSelector.active && (
            <Rectangle {...getStepSelectorRectangle(eventVars.stepSelector)} />
          )}
        </PipelineViewport>
        {pipelineJson && (
          <div className="pipeline-actions bottom-left">
            <div className="navigation-buttons">
              <IconButton
                title="Center"
                data-test-id="pipeline-center"
                onPointerDown={canvasFuncRef.current?.centerView}
              >
                <CropFreeIcon />
              </IconButton>
              <IconButton
                title="Zoom out"
                onPointerDown={() => {
                  // NOTE: onClick also listens to space bar press when button is focused
                  // it causes issue when user press space bar to navigate the canvas
                  // thus, onPointerDown should be used here, so zoom-out only is triggered if user mouse down on the button
                  canvasFuncRef.current?.centerPipelineOrigin();
                  dispatch({
                    type: "SET_SCALE_FACTOR",
                    payload: eventVars.scaleFactor - 0.25,
                  });
                }}
              >
                <RemoveIcon />
              </IconButton>
              <IconButton
                title="Zoom in"
                onPointerDown={() => {
                  canvasFuncRef.current?.centerPipelineOrigin();
                  dispatch({
                    type: "SET_SCALE_FACTOR",
                    payload: eventVars.scaleFactor + 0.25,
                  });
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
            {!isReadOnly &&
              !pipelineRunning &&
              eventVars.selectedSteps.length > 0 &&
              !eventVars.stepSelector.active && (
                <div className="selection-buttons">
                  <Button
                    variant="contained"
                    onClick={runSelectedSteps}
                    data-test-id="interactive-run-run-selected-steps"
                  >
                    Run selected steps
                  </Button>
                  {selectedStepsHasIncoming && (
                    <Button
                      variant="contained"
                      onClick={onRunIncoming}
                      data-test-id="interactive-run-run-incoming-steps"
                    >
                      Run incoming steps
                    </Button>
                  )}
                </div>
              )}
            {pipelineRunning && (
              <div className="selection-buttons">
                <PipelineActionButton
                  onClick={cancelRun}
                  startIcon={<CloseIcon />}
                  disabled={isCancellingRun}
                  data-test-id="interactive-run-cancel"
                >
                  Cancel run
                </PipelineActionButton>
              </div>
            )}
          </div>
        )}
        {pipelineJson && (
          <div className={"pipeline-actions top-right"}>
            {!isReadOnly && (
              <CreateNextStepButton pipelineViewportRef={pipelineViewportRef} />
            )}
            {isReadOnly && (
              <Button color="secondary" startIcon={<VisibilityIcon />} disabled>
                Read only
              </Button>
            )}
            <PipelineActionButton
              onClick={openLogs}
              onAuxClick={openLogs}
              startIcon={<ViewHeadlineIcon />}
            >
              Logs
            </PipelineActionButton>
            <PipelineActionButton
              id="running-services-button"
              onClick={showServices}
              startIcon={<SettingsIcon />}
              ref={servicesButtonRef}
            >
              Services
            </PipelineActionButton>
            <ServicesMenu
              isOpen={isShowingServices}
              onClose={hideServices}
              anchor={servicesButtonRef}
              services={services}
            />
            <PipelineActionButton
              onClick={openSettings}
              startIcon={<TuneIcon />}
              data-test-id="pipeline-settings"
            >
              Settings
            </PipelineActionButton>
          </div>
        )}
      </div>
      <StepDetails
        key={eventVars.openedStep}
        onSave={onSaveDetails}
        onDelete={onDetailsDelete}
        onOpenFilePreviewView={onOpenFilePreviewView}
        onOpenNotebook={onOpenNotebook}
      />

      {hasSelectedSteps && !isReadOnly && (
        <div className={"pipeline-actions bottom-right"}>
          <PipelineActionButton
            onClick={deleteSelectedSteps}
            startIcon={<DeleteIcon />}
            disabled={isDeletingSteps}
            data-test-id="step-delete-multi"
          >
            Delete
          </PipelineActionButton>
        </div>
      )}
    </div>
  );
};
