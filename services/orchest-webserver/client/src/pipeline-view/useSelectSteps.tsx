import { useAppContext } from "@/contexts/AppContext";
import type {
  Connection,
  MouseTracker,
  Offset,
  Position,
  Step,
  StepsDict,
} from "@/types";
import { addOutgoingConnections } from "@/utils/webserver-utils";
import { intersectRect } from "@orchest/lib-utils";
import produce, { original } from "immer";
import merge from "lodash.merge";
import React from "react";
import {
  getPositionFromOffset,
  localElementPosition,
  scaleCorrectedPosition,
} from "./common";
import { getStepSelectorRectangle } from "./Rectangle";

export const nodeCenter = (
  el: HTMLElement,
  parentEl: HTMLElement,
  scaleFactor: number
) => {
  let nodePosition = localElementPosition(
    $(el).offset(),
    $(parentEl).offset(),
    scaleFactor
  );
  nodePosition.x += $(el).width() / 2;
  nodePosition.y += $(el).height() / 2;
  return nodePosition;
};

type PipelineStepsState = {
  selectedSteps: string[];
  error?: string | null;
};

type EventVars = {
  // mouseClientX: number;
  // mouseClientY: number;
  // draggingCanvas: boolean;
  // keysDown: Record<string, boolean>;
  // prevPosition: [number, number];
  doubleClickFirstClick: boolean;
  scaleFactor: number;
  steps: StepsDict;
  selectedSteps: string[];
  connections: Connection[];
  selectedConnection?: Connection;
  openedMultiStep: boolean;
  openedStep?: string;
  newConnection: Connection;
  stepSelector: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    active: boolean;
  };
  error?: string | null;
};

type Action =
  | {
      type: "SELECT_STEPS";
      payload: string[];
    }
  | {
      type: "SELECT_CONNECTION";
      payload: {
        startNodeUUID: string;
        endNodeUUID: string;
      };
    }
  | { type: "DESELECT_STEPS" }
  | {
      type: "DESELECT_CONNECTION";
    }
  | {
      type: "SET_OPENED_STEP";
      payload: string | undefined;
    }
  | {
      type: "CREATE_CONNECTION_INSTANCE";
      payload: Connection;
    }
  | {
      type: "MAKE_CONNECTION";
      payload: string;
    }
  | { type: "REMOVE_CONNECTION"; payload: Connection }
  | { type: "REMOVE_STEPS"; payload: string[] }
  | {
      type: "SAVE_STEP_DETAILS";
      payload: {
        stepChanges: Partial<Step>;
        uuid: string;
        replace: boolean;
      };
    }
  | { type: "SET_KEYS_DOWN"; payload: Record<string, boolean> }
  | {
      type: "CREATE_SELECTOR";
      payload: Offset;
    }
  | {
      type: "SET_SCALE_FACTOR";
      payload: number;
    }
  | {
      type: "UPDATE_STEP_SELECTOR";
      payload: Offset;
    }
  | {
      type: "UPDATE_NEW_CONNECTION_END_NODE";
      payload: Offset;
    }
  | {
      type: "SET_STEP_SELECTOR_INACTIVE";
    }
  | {
      type: "SET_ERROR";
      payload: string | null;
    };

type ActionCallback = (previousState: PipelineStepsState) => Action | void;

export type PipelineStepsStateAction = Action | ActionCallback | undefined;

const DEFAULT_SCALE_FACTOR = 1;
const DRAG_CLICK_SENSITIVITY = 3;

const DEFAULT_STEP_SELECTOR = {
  x1: Number.MIN_VALUE,
  y1: Number.MIN_VALUE,
  x2: Number.MIN_VALUE,
  y2: Number.MIN_VALUE,
  active: false,
};

export const useSelectSteps = () => {
  const { setAlert } = useAppContext();
  // Ref's
  const stepDomRefs = React.useRef<Record<string, HTMLDivElement>>({});
  const mouseClient = React.useRef<Position>({ x: 0, y: 0 });
  const mouseTracker = React.useRef<MouseTracker>({
    prev: { x: 0, y: 0 },
    delta: { x: 0, y: 0 },
  });

  const positionDelta = React.useRef<Position>({ x: 0, y: 0 });

  const selectedSingleStep = React.useRef<string>();

  const [eventVars, eventVarsDispatch] = React.useReducer(
    produce((state: PipelineStepsState, _action: PipelineStepsStateAction) => {
      const action = _action instanceof Function ? _action(state) : _action;

      if (!action) return;

      /**
       * =================== common functions inside of reducer
       */

      const getConnectionByUUIDs = (
        startNodeUUID: string,
        endNodeUUID: string
      ) => {
        return state.connections.find((connection) => {
          return (
            connection.startNodeUUID === startNodeUUID &&
            connection.endNodeUUID === endNodeUUID
          );
        });
      };

      const dfsWithSets = (
        step_uuid: string,
        whiteSet: Set<string>,
        greySet: Set<string>
      ) => {
        // move from white to grey
        whiteSet.delete(step_uuid);
        greySet.add(step_uuid);

        for (
          let x = 0;
          x < state.steps[step_uuid].outgoing_connections.length;
          x++
        ) {
          let child_uuid = state.steps[step_uuid].outgoing_connections[x];

          if (whiteSet.has(child_uuid)) {
            if (dfsWithSets(child_uuid, whiteSet, greySet)) {
              return true;
            }
          } else if (greySet.has(child_uuid)) {
            return true;
          }
        }

        // move from grey to black
        greySet.delete(step_uuid);
      };

      const willCreateCycle = (startNodeUUID: string, endNodeUUID: string) => {
        // add connection temporarily
        let insertIndex =
          state.steps[endNodeUUID].incoming_connections.push(startNodeUUID) - 1;

        let whiteSet = new Set(Object.keys(state.steps));
        let greySet = new Set<string>();

        let cycles = false;

        while (whiteSet.size > 0) {
          // take first element left in whiteSet
          let step_uuid = whiteSet.values().next().value;

          if (dfsWithSets(step_uuid, whiteSet, greySet)) {
            cycles = true;
          }
        }

        // remove temp connection
        state.steps[endNodeUUID].incoming_connections.splice(insertIndex, 1);

        return cycles;
      };

      const saveStepsSelectedByRect = () => {
        let rect = getStepSelectorRectangle(state.stepSelector);

        // for each step perform intersect
        if (state.stepSelector.active) {
          state.selectedSteps = [];
          Object.values(state.steps).forEach((step) => {
            // guard against ref existing, in case step is being added
            if (stepDomRefs.current[step.uuid]) {
              const stepContainer = stepDomRefs.current[step.uuid];

              let stepDom = $(stepContainer);

              let stepRect = {
                x: step.meta_data.position[0],
                y: step.meta_data.position[1],
                width: stepDom.outerWidth(),
                height: stepDom.outerHeight(),
              };

              if (intersectRect(rect, stepRect)) {
                state.selectedSteps.push(step.uuid);
              }
            }
          });
        }
      };

      const makeConnection = (endNodeUUID: string) => {
        // Prerequisites
        // 1. mousedown on a node (i.e. startNodeUUID is confirmed)
        // 2. mousemove -> start dragging, drawing an connection line, the end of the line is following mouse curser
        //
        // then user mouseup, we need to get endNodeUUID to finish the creation of the new connection

        let startNodeUUID = state.newConnection?.startNodeUUID;

        // ==== startNodeUUID is required, abort if missing

        if (!startNodeUUID) {
          console.error(
            "Failed to make connection. startNodeUUID is undefined."
          );
          return;
        }

        // ==== user didn't mouseup on a step, abort

        if (!endNodeUUID) {
          removeConnection(state.newConnection);
          console.error("Failed to make connection. endNodeUUID is undefined.");
          return;
        }

        // ==== check if it's a valid connection

        // ! assign this function to <div className="incoming-connections" />
        // TODO: remove this
        //   so that we don't need to do low-level checking here

        // check whether drag release was on .incoming-connections class
        // let dragEndedInIncomingConnectionsElement = $(e.target).hasClass(
        //   "incoming-connections"
        // );

        // ==== check whether there already exists a connection
        let connectionAlreadyExists = state.steps[
          endNodeUUID
        ].incoming_connections.includes(startNodeUUID);

        if (connectionAlreadyExists) {
          removeConnection(state.newConnection);
          state.error =
            "These steps are already connected. No new connection has been created.";

          return;
        }

        // ==== check whether connection will create a cycle in Pipeline graph
        let connectionCreatesCycle =
          !connectionAlreadyExists &&
          willCreateCycle(startNodeUUID, endNodeUUID);

        if (connectionCreatesCycle) {
          removeConnection(state.newConnection);
          state.error =
            "Connecting this step will create a cycle in your pipeline which is not supported.";

          return;
        }

        // ==== Start creating a connection

        // TODO: check how connection line is drawn. is incoming_connections the only thing to change?
        if (
          !state.steps[endNodeUUID].incoming_connections.includes(startNodeUUID)
        ) {
          state.steps[endNodeUUID].incoming_connections.push(startNodeUUID);
        }
      };

      const removeConnection = ({
        startNodeUUID,
        endNodeUUID,
      }: Pick<Connection, "startNodeUUID" | "endNodeUUID">) => {
        // when deleting connections, it's impossible that user is also creating a new connection
        // thus, we always clean it up.
        state.newConnection = undefined;

        // remove it from the state.connections array
        const foundIndex = state.connections.findIndex((connection) => {
          const matchStart = connection.startNodeUUID === startNodeUUID;

          const matchEnd =
            !endNodeUUID || connection.endNodeUUID === endNodeUUID;

          return matchStart && matchEnd;
        });

        if (foundIndex < 0) return;
        state.connections.splice(foundIndex, 1);

        if (!endNodeUUID) return;

        // remove it from the incoming_connections of its subsequent nodes
        const subsequentStep = state.steps[endNodeUUID];

        subsequentStep.incoming_connections = subsequentStep.incoming_connections.filter(
          (startNodeUuid) => startNodeUuid !== endNodeUUID
        );
      };

      const selectSteps = (steps: string[]) => {
        state.selectedSteps = [];
        steps.forEach((stepUuid) => state.selectedSteps.push(stepUuid));
        state.openedMultiStep = steps.length > 1;
      };

      const deselectSteps = () => {
        state.selectedSteps = [];
        state.stepSelector = DEFAULT_STEP_SELECTOR;
        state.openedMultiStep = false;
        // deselecting will close the detail view
        state.openedStep = undefined;
      };

      /**
       * Get position for new step so it doesn't spawn on top of other
       * new steps.
       * @param initialPosition Default position of new step.
       * @param baseOffset The offset to use for X and Y.
       */
      const getNewStepPosition = (
        initialPosition: [number, number],
        baseOffset = 15
      ) => {
        const stepPositions = new Set();
        Object.values(state.steps).forEach((step) => {
          // Make position hashable.
          stepPositions.add(String(step.meta_data.position));
        });

        let position = [...initialPosition];
        while (stepPositions.has(String(position))) {
          position = [position[0] + baseOffset, position[1] + baseOffset];
        }
        return position as [number, number];
      };

      console.log("HM", action.type);

      /**
       * action handlers
       */
      switch (action.type) {
        case "SET_SCALE_FACTOR": {
          state.scaleFactor = action.payload;
          break;
        }
        case "SET_STEPS": {
          state.steps = addOutgoingConnections(action.payload);
          break;
        }
        case "CREATE_STEP": {
          const newStep = action.payload;

          if (state.steps[newStep.uuid]) {
            state.error = "Step already exists";
            break;
          }

          // in case any existing step is on the exact same position
          newStep.meta_data.position = getNewStepPosition(
            newStep.meta_data.position
          );

          deselectSteps();
          selectSteps([newStep.uuid]);

          state.steps[newStep.uuid] = newStep;

          break;
        }
        case "MOVE_STEPS": {
          const stepUuid = selectedSingleStep.current;
          const originalState = original(state);
          let originalStep = originalState.steps[stepUuid];
          if (!originalStep) break;

          state.steps[stepUuid].meta_data._drag_count++;
          if (originalStep.meta_data._drag_count >= DRAG_CLICK_SENSITIVITY) {
            state.steps[stepUuid].meta_data._dragged = true;
            state.steps[stepUuid].meta_data._drag_count = 0;
          }

          // check for space bar, i.e. not dragging canvas
          if (keysDown.current[32]) break;

          const originalSelectedSteps = originalState.selectedSteps;
          // this should never happen,
          // when mouse down a step, the step should be added to selectedSteps at the same time

          if (!originalSelectedSteps.includes(stepUuid)) break;

          // if user selected multiple steps, they will move together
          originalSelectedSteps.forEach((uuid) => {
            const originalPosition =
              originalState.steps[uuid].meta_data.position;

            state.steps[uuid].meta_data.position[0] =
              originalPosition[0] + positionDelta.current.x;
            state.steps[uuid].meta_data.position[1] =
              originalPosition[1] + positionDelta.current.y;
          });

          break;
        }
        case "CREATE_SELECTOR": {
          // not dragging the canvas, so user must be creating a selection rectangle
          state.selectedSteps = [];
          selectedSingleStep.current = undefined;
          const selectorOrigin = getPositionFromOffset({
            offset: action.payload,
            position: mouseClient.current,
            scaleFactor: original(state).scaleFactor,
          });

          state.stepSelector = {
            x1: selectorOrigin.x,
            x2: selectorOrigin.x,
            y1: selectorOrigin.y,
            y2: selectorOrigin.y,
            active: true,
          };

          break;
        }
        case "SET_STEP_SELECTOR_INACTIVE": {
          state.stepSelector.active = false;
          break;
        }
        case "SELECT_STEPS": {
          selectSteps(action.payload);
          break;
        }
        case "SELECT_SINGLE_STEP": {
          // this is the step that user's current mouse-down target.
          // at the same time, user might already select multiple steps, there are 2 cases
          // - this current mouse-down target is part of the selected steps:
          //   then user can drag the current mouse-down target, and all the rest of selected steps would follow
          // - this current mouse-down target is NOT part of the selected steps:
          //   deselect the rest, as if user only select the current mouse-down target
          selectedSingleStep.current = action.payload;
          if (
            action.payload &&
            !original(state).selectedSteps.includes(action.payload)
          ) {
            state.selectedSteps = [action.payload];
            // TODO: press SHIFT/CTRL to add action.payload to current state.selectedSteps
          }
          break;
        }
        case "DESELECT_STEPS": {
          deselectSteps();
          break;
        }
        case "DESELECT_CONNECTION": {
          // return { ...state, selectedConnection: undefined };
          state.selectedConnection = undefined;
          break;
        }

        case "SELECT_CONNECTION": {
          const selectedConnection = getConnectionByUUIDs(
            action.payload.startNodeUUID,
            action.payload.endNodeUUID
          );
          state.selectedSteps = [];
          state.stepSelector = DEFAULT_STEP_SELECTOR;

          if (!selectedConnection) {
            console.error("Unable to find the connection to select");
            break;
          }

          selectedConnection.selected = true;
          state.selectedConnection = selectedConnection;
          break;
        }

        case "SET_OPENED_STEP": {
          state.openedStep = action.payload;
          if (action.payload) {
            // action.payload is a valid step UUID
            // i.e. open a step, and this step should also be selected
            selectSteps([action.payload]);
            state.openedMultiStep = false;
          }
          break;
        }

        case "UPDATE_STEP_SELECTOR": {
          const { x, y } = getPositionFromOffset({
            offset: action.payload,
            position: mouseClient.current,
            scaleFactor: original(state).scaleFactor,
          });

          state.stepSelector.x2 = x;
          state.stepSelector.y2 = y;

          saveStepsSelectedByRect();

          break;
        }

        case "UPDATE_NEW_CONNECTION_END_NODE": {
          const { x, y } = getPositionFromOffset({
            offset: action.payload,
            position: mouseClient.current,
            scaleFactor: original(state).scaleFactor,
          });

          state.newConnection.xEnd = x;
          state.newConnection.yEnd = y;

          break;
        }

        // this means that the connection might not yet complete, as endNodeUUID is optional
        // this action creates an instance
        case "CREATE_CONNECTION_INSTANCE": {
          state.connections.push(action.payload);
          if (!action.payload.endNodeUUID) {
            state.newConnection = action.payload;
          }
          break;
        }

        case "MAKE_CONNECTION": {
          makeConnection(action.payload);
          break;
        }

        case "REMOVE_CONNECTION": {
          removeConnection(action.payload);
          break;
        }

        case "REMOVE_STEPS": {
          // also delete incoming connections that contain this uuid
          const stepsToDelete = action.payload;
          stepsToDelete.forEach((uuid) => {
            // remove the connections between current step and its subsequent nodes
            Object.values(state.steps).forEach((step) => {
              const isSubsequentNode = step.incoming_connections.includes(uuid);
              if (isSubsequentNode) {
                removeConnection({
                  startNodeUUID: uuid,
                  endNodeUUID: step.uuid,
                });
              }
            });

            // remove the connections between current step and its preceding nodes
            let currentStep = state.steps[uuid];
            currentStep.incoming_connections.forEach((incomingConnection) => {
              const connectionToPrecedingStep = getConnectionByUUIDs(
                incomingConnection,
                uuid
              );
              removeConnection(connectionToPrecedingStep);
            });

            delete state.steps[uuid];

            state.openedStep = undefined;
            // when removing a step, the selection of any step is also cancelled
            // we can simply clean up state.selectedSteps, instead of remove them one by one
            // TODO: double-check if it's true
            state.selectedSteps = [];
          });

          break;
        }

        case "SAVE_STEP_DETAILS": {
          const { replace, stepChanges, uuid } = action.payload;
          // Mutate step with changes
          if (replace) {
            // Replace works on the top level keys that are provided
            Object.entries(stepChanges).forEach(([propKey, mutation]) => {
              state.steps[uuid][propKey] = mutation;
            });
          } else {
            merge(state.steps[uuid], stepChanges);
          }

          break;
        }

        case "SET_KEYS_DOWN": {
          keysDown.current = { ...keysDown.current, ...action.payload };
          break;
        }

        case "SET_ERROR": {
          state.error = action.payload;
          break;
        }

        default: {
          console.error(`[EventVars] Unknown action: "${action}"`);
          break;
        }
      }
    }),
    /**
     *          End of reducer
     * ==========================================================
     *          Beginning of initial state
     */
    {
      selectedSteps: [],
    }
  );

  // this function doesn't trigger update, it simply persists clientX clientY for calculation
  const trackMouseMovement = React.useCallback(
    (clientX: number, clientY: number) => {
      mouseClient.current = { x: clientX, y: clientY };
      // get the distance of the movement, and update prevPosition
      const previous = mouseTracker.current.prev;

      mouseTracker.current.delta = {
        x: scaleCorrectedPosition(clientX, eventVars.scaleFactor) - previous.x,
        y: scaleCorrectedPosition(clientY, eventVars.scaleFactor) - previous.y,
      };

      mouseTracker.current.prev = {
        x: scaleCorrectedPosition(clientX, eventVars.scaleFactor),
        y: scaleCorrectedPosition(clientY, eventVars.scaleFactor),
      };
    },
    [eventVars.scaleFactor]
  );

  React.useEffect(() => {
    if (eventVars.error) {
      setAlert("Error", eventVars.error, (resolve) => {
        eventVarsDispatch({ type: "SET_ERROR", payload: null });
        resolve(true);
        return true;
      });
    }
  }, [eventVars.error, setAlert]);

  return {
    eventVars,
    mouseClient,
    eventVarsDispatch,
    stepDomRefs,
    keysDown,
    selectedSingleStep,
    trackMouseMovement,
    mouseTracker,
  };
};
