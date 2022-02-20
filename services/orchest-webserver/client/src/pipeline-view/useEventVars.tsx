import { useAppContext } from "@/contexts/AppContext";
import { shallowEqualByKey } from "@/environment-edit-view/shallowEqualByKey";
import type {
  Connection,
  Offset,
  PipelineStepState,
  Position,
  Step,
} from "@/types";
import { addOutgoingConnections } from "@/utils/webserver-utils";
import { intersectRect } from "@orchest/lib-utils";
import produce from "immer";
import merge from "lodash.merge";
import React from "react";
import { getStepSelectorRectangle } from "./Rectangle";

export const scaleCorrectedPosition = (
  position: number,
  scaleFactor: number
) => {
  position /= scaleFactor;
  return position;
};

const localElementPosition = (
  offset: Offset,
  parentOffset: Offset,
  scaleFactor: number
) => {
  return {
    x: scaleCorrectedPosition(offset.left - parentOffset.left, scaleFactor),
    y: scaleCorrectedPosition(offset.top - parentOffset.top, scaleFactor),
  };
};

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

type EventVars = {
  // mouseClientX: number;
  // mouseClientY: number;
  // draggingCanvas: boolean;
  keysDown: Record<string, boolean>;
  prevPosition: [number, number];
  doubleClickFirstClick: boolean;
  scaleFactor: number;
  steps: Record<string, PipelineStepState>;
  selectedSingleStep?: string;
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
      type: "SET_STEPS";
      payload: Record<string, PipelineStepState>;
    }
  | {
      type: "CREATE_STEP";
      payload: PipelineStepState;
    }
  | {
      type: "SELECT_STEPS";
      payload: string[];
    }
  | {
      type: "SELECT_SINGLE_STEP";
      payload: string;
    }
  | {
      type: "MOVE_STEPS";
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
      type: "ON_MOUSE_DOWN_CANVAS";
      payload: {
        mouseClientX: number;
        mouseClientY: number;
        pipelineStepHolderOffset: Offset | null;
      };
    }
  | {
      type: "SET_SCALE_FACTOR";
      payload: number;
    }
  | {
      type: "UPDATE_STEP_SELECTOR";
      payload: {
        offset: Offset;
        mouseClientX: number;
        mouseClientY: number;
      };
    }
  | {
      type: "UPDATE_NEW_CONNECTION_END_NODE";
      payload: {
        mouseClientX: number;
        mouseClientY: number;
        offset: { left: number; top: number };
      };
    }
  | {
      type: "SET_ERROR";
      payload: string | null;
    };

type ActionCallback = (previousState: EventVars) => Action | void;

export type EventVarsAction = Action | ActionCallback | undefined;

const DEFAULT_SCALE_FACTOR = 1;
const DRAG_CLICK_SENSITIVITY = 3;

const DEFAULT_STEP_SELECTOR = {
  x1: Number.MIN_VALUE,
  y1: Number.MIN_VALUE,
  x2: Number.MIN_VALUE,
  y2: Number.MIN_VALUE,
  active: false,
};
// const DESELECT_STEPS_PAYLOAD = {
//   selectedSteps: [],
//   stepSelector: DEFAULT_STEP_SELECTOR,
// };

export const useEventVars = () => {
  const { setAlert } = useAppContext();
  const stepDomRefs = React.useRef<Record<string, HTMLDivElement>>({});
  const prevPosition = React.useRef<Position>({ x: 0, y: 0 });
  const positionDelta = React.useRef<Position>({ x: 0, y: 0 });

  const [eventVars, eventVarsDispatch] = React.useReducer(
    produce((state: EventVars, _action: EventVarsAction) => {
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

      const getSelectedSteps = () => {
        let rect = getStepSelectorRectangle(state.stepSelector);

        let selectedSteps = [];

        // for each step perform intersect
        if (state.stepSelector.active) {
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
                selectedSteps.push(step.uuid);
              }
            }
          });
        }

        return selectedSteps;
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

      const removeConnection = (connectionToDelete: Connection) => {
        state.connections.splice(
          state.connections.indexOf(connectionToDelete),
          1
        );

        const subsequentStep =
          state.steps[connectionToDelete.endNodeUUID || ""];
        // remove it from the state.connections array
        const foundIndex = state.connections.findIndex((connection) => {
          return (
            !subsequentStep ||
            !shallowEqualByKey(connection, connectionToDelete, [
              "endNodeUUID",
              "startNodeUUID",
            ])
          );
        });
        state.connections.splice(foundIndex, 1);

        // remove it from the incoming_connections of its subsequent nodes

        state.steps[
          subsequentStep.uuid
        ].incoming_connections = subsequentStep.incoming_connections.filter(
          (startNodeUuid) => startNodeUuid !== connectionToDelete.endNodeUUID
        );

        // when deleting connections, it's impossible that user is also creating a new connection
        // thus, we always clean it up.
        state.newConnection = undefined;
      };

      const selectSteps = (steps: string[]) => {
        state.selectedSteps = steps;
        if (steps.length === 1) {
          state.openedStep = steps[0];
          state.openedMultiStep = false;
        }
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

      /**
       * action handlers
       */
      switch (action.type) {
        case "SET_SCALE_FACTOR": {
          state.scaleFactor = action.payload;
          break;
        }
        case "SET_STEPS": {
          // return { ...state, steps: action.payload };
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
          // check if user starts dragging state.selectedSingleStep
          let step = state.steps[state.selectedSingleStep];
          step.meta_data._drag_count++;
          if (step.meta_data._drag_count >= DRAG_CLICK_SENSITIVITY) {
            step.meta_data._dragged = true;
            step.meta_data._drag_count = 0;
          }

          // check for spacebar, i.e. not dragging canvas
          if (!state.keysDown[32]) break;

          // if user selected multiple steps, they will move together
          if (
            state.selectedSteps.length > 1 &&
            state.selectedSteps.includes(state.selectedSingleStep)
          ) {
            state.selectedSteps.forEach((uuid) => {
              let singleStep = state.steps[uuid];

              singleStep.meta_data.position[0] += positionDelta.current.x;
              singleStep.meta_data.position[1] += positionDelta.current.y;
            });
          } else if (state.selectedSingleStep) {
            step.meta_data.position[0] += positionDelta.current.x;
            step.meta_data.position[1] += positionDelta.current.y;
          }

          break;
        }
        case "ON_MOUSE_DOWN_CANVAS": {
          const {
            mouseClientX,
            mouseClientY,
            pipelineStepHolderOffset,
          } = action.payload;

          // state.mouseClientX = mouseClientX;
          // state.mouseClientY = mouseClientY;
          // not dragging the canvas, so user must be creating a selection rectangle
          if (pipelineStepHolderOffset) {
            const { left, top } = pipelineStepHolderOffset;
            state.stepSelector.active = true;
            state.stepSelector.x1 = state.stepSelector.x2 =
              scaleCorrectedPosition(mouseClientX, state.scaleFactor) -
              scaleCorrectedPosition(left, state.scaleFactor);
            state.stepSelector.y1 = state.stepSelector.y2 =
              scaleCorrectedPosition(mouseClientY, state.scaleFactor) -
              scaleCorrectedPosition(top, state.scaleFactor);

            state.selectedSteps = getSelectedSteps();
          }
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
          state.selectedSingleStep = action.payload;
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
          // return { ...state, openedStep: action.payload };
          state.openedStep = action.payload;
          break;
        }

        case "UPDATE_STEP_SELECTOR": {
          const {
            mouseClientX,
            mouseClientY,
            offset: { top, left },
          } = action.payload;
          state.stepSelector.x2 =
            scaleCorrectedPosition(mouseClientX, state.scaleFactor) -
            scaleCorrectedPosition(left, state.scaleFactor);
          state.stepSelector.y2 =
            scaleCorrectedPosition(mouseClientY, state.scaleFactor) -
            scaleCorrectedPosition(top, state.scaleFactor);

          state.selectedSteps = getSelectedSteps();

          break;
        }

        case "UPDATE_NEW_CONNECTION_END_NODE": {
          const {
            mouseClientX,
            mouseClientY,
            offset: { top, left },
          } = action.payload;
          state.newConnection.xEnd =
            scaleCorrectedPosition(mouseClientX, state.scaleFactor) -
            scaleCorrectedPosition(left, state.scaleFactor);
          state.newConnection.yEnd =
            scaleCorrectedPosition(mouseClientY, state.scaleFactor) -
            scaleCorrectedPosition(top, state.scaleFactor);

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
          // const connectionToDelete = action.payload;
          removeConnection(action.payload);

          break;
        }

        case "REMOVE_STEPS": {
          // also delete incoming connections that contain this uuid
          const uuids = action.payload;
          uuids.forEach((uuid) => {
            // for (let key in state.steps) {
            //   if (state.steps.hasOwnProperty(key)) {
            Object.values(state.steps).forEach((step) => {
              // let step = state.steps[key];

              let connectionIndex = step.incoming_connections.indexOf(uuid);
              if (connectionIndex !== -1) {
                // also delete incoming connections from GUI
                let connection = getConnectionByUUIDs(uuid, step.uuid);
                removeConnection(connection);
              }
            });
            //   }
            // }

            // visually delete incoming connections from GUI
            let step = state.steps[uuid];
            let connectionsToRemove = [];

            // removeConnection modifies incoming_connections, hence the double
            // loop.
            for (let x = 0; x < step.incoming_connections.length; x++) {
              connectionsToRemove.push(
                getConnectionByUUIDs(step.incoming_connections[x], uuid)
              );
            }
            for (let connection of connectionsToRemove) {
              removeConnection(connection);
            }

            delete state.steps[uuid];

            state.openedStep = undefined;
            state.selectedSteps = [];

            // ? when removing a step, the selection of any step is also cancelled
            // we can simply clean up state.selectedSteps, instead of remove them one by one

            // // if step is in selectedSteps remove it
            // let deletedStepIndex = state.selectedSteps.indexOf(uuid);
            // if (deletedStepIndex >= 0) {
            //   state.selectedSteps.splice(deletedStepIndex, 1);
            // }
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
          state.keysDown = { ...state.keysDown, ...action.payload };
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
      keysDown: {},
      // mouseClientX: 0,
      // mouseClientY: 0,
      // draggingCanvas: false,
      prevPosition: [null, null],
      doubleClickFirstClick: false,
      selectedConnection: undefined,
      selectedSingleStep: undefined,
      newConnection: undefined,
      openedStep: undefined,
      openedMultiStep: undefined,
      selectedSteps: [],
      stepSelector: {
        active: false,
        x1: 0,
        y1: 0,
        x2: 0,
        y2: 0,
      },
      steps: {},
      scaleFactor: DEFAULT_SCALE_FACTOR,
      connections: [],
    }
  );

  // this function doesn't trigger update, it simply persists clientX clientY for calculation
  const trackMouseMovement = React.useCallback(
    (clientX: number, clientY: number) => {
      // get the distance of the movement, and update prevPosition
      const previousX = prevPosition.current.x;
      const previousY = prevPosition.current.y;

      positionDelta.current = {
        x: scaleCorrectedPosition(clientX, eventVars.scaleFactor) - previousX,
        y: scaleCorrectedPosition(clientY, eventVars.scaleFactor) - previousY,
      };

      prevPosition.current = {
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

  return { eventVars, eventVarsDispatch, stepDomRefs, trackMouseMovement };
};
