import { useAppContext } from "@/contexts/AppContext";
import type {
  Connection,
  NewConnection,
  PipelineStepState,
  ReducerActionWithCallback,
  Step,
  StepsDict,
} from "@/types";
import { getOuterHeight, getOuterWidth } from "@/utils/jquery-replacement";
import { hasValue, intersectRect, uuidv4 } from "@orchest/lib-utils";
import produce from "immer";
import merge from "lodash.merge";
import React from "react";
import { willCreateCycle } from "../common";
import { usePipelineUiStatesContext } from "../contexts/PipelineUiStatesContext";
import { getStepSelectorRectangle } from "../Rectangle";

export type EventVars = {
  initialized: boolean;
  doubleClickFirstClick: boolean;
  steps: StepsDict;
  selectedSteps: string[];
  cursorControlledStep: string | undefined;
  connections: Connection[];
  selectedConnection: Pick<Connection, "endNodeUUID" | "startNodeUUID"> | null;
  openedMultiStep?: boolean;
  openedStep?: string;
  error?: string | null;
  timestamp: number | undefined;
};

export type Action =
  | {
      type: "SET_STEPS";
      payload: StepsDict;
    }
  | {
      type: "SAVE_STEPS";
      payload: StepsDict;
    }
  | {
      type: "CREATE_STEP";
      payload: PipelineStepState;
    }
  | {
      type: "DUPLICATE_STEPS";
      payload: string[];
    }
  | {
      type: "ASSIGN_FILE_TO_STEP";
      payload: {
        filePath: string;
        stepUuid: string;
      };
    }
  | {
      type: "SELECT_STEPS";
      payload: {
        uuids: string[];
        inclusive?: boolean;
      };
    }
  | { type: "DESELECT_STEPS"; payload: string[] }
  | {
      type: "SELECT_CONNECTION";
      payload: {
        startNodeUUID: string;
        endNodeUUID: string;
      };
    }
  | { type: "DESELECT_CONNECTION" }
  | {
      type: "SET_OPENED_STEP";
      payload: string | undefined;
    }
  | {
      type: "SET_CURSOR_CONTROLLED_STEP";
      payload: string | undefined;
    }
  | {
      type: "INSTANTIATE_CONNECTION";
      payload: Connection;
    }
  | {
      type: "MAKE_CONNECTION";
      payload: string;
    }
  | {
      type: "REMOVE_CONNECTION";
      payload: Pick<Connection, "startNodeUUID" | "endNodeUUID">;
    }
  | { type: "REMOVE_STEPS"; payload: string[] }
  | {
      type: "SAVE_STEP_DETAILS";
      payload: {
        stepChanges: Partial<Step>;
        uuid: string;
        replace?: boolean;
      };
    }
  | {
      type: "SET_ERROR";
      payload: string | null;
    }
  | {
      type: "DESELECT_ALL_STEPS";
    };

export type EventVarsAction =
  | ReducerActionWithCallback<EventVars, Action>
  | undefined;

export function removeConnection<
  T extends Pick<EventVars, "steps" | "connections">
>(baseState: T, connectionToDelete: Connection | NewConnection | null): T {
  if (!connectionToDelete) return baseState;

  const { startNodeUUID, endNodeUUID } = connectionToDelete;

  const updatedConnections = baseState.connections.filter((connection) => {
    return (
      connection.startNodeUUID !== startNodeUUID ||
      connection.endNodeUUID !== endNodeUUID
    );
  });

  const subsequentStep = endNodeUUID ? baseState.steps[endNodeUUID] : undefined;

  const updatedState = {
    ...baseState,
    connections: updatedConnections,
    selectedConnection: null,
  };

  if (!endNodeUUID || !subsequentStep) return updatedState;

  // remove it from the incoming_connections of its subsequent nodes
  // we don't have to clean up outgoing_connections
  const subsequentStepIncomingConnections = subsequentStep.incoming_connections.filter(
    (incomingConnectionUuid) => incomingConnectionUuid !== startNodeUUID
  );

  updatedState.steps = produce(updatedState.steps, (draft) => {
    draft[endNodeUUID].incoming_connections = subsequentStepIncomingConnections;
  });
  return updatedState;
}

// use timestamp to trigger saving to BE
function withTimestamp<T extends Record<string, unknown>>(obj: T) {
  return {
    ...obj,
    timestamp: new Date().getTime(),
  };
}

export const useEventVars = () => {
  const { setAlert } = useAppContext();

  // Ref's
  const stepDomRefs = React.useRef<Record<string, HTMLDivElement>>({});
  // this is used for temporarily saving dragged steps' positions
  const metadataPositions = React.useRef<Record<string, [number, number]>>({});

  const newConnection = React.useRef<NewConnection>();

  const {
    uiStates: { stepSelector },
    uiStatesDispatch,
  } = usePipelineUiStatesContext();

  const memoizedReducer = React.useCallback(
    (state: EventVars, _action: EventVarsAction): EventVars => {
      const action = _action instanceof Function ? _action(state) : _action;

      if (!action) return state;

      /**
       * =================== common functions inside of reducer
       */

      const getConnectionIndexByUUIDs = (
        startNodeUUID: string,
        endNodeUUID: string
      ) => {
        return state.connections.findIndex((connection) => {
          return (
            connection.startNodeUUID === startNodeUUID &&
            connection.endNodeUUID === endNodeUUID
          );
        });
      };

      const makeConnection = (endNodeUUID: string): EventVars => {
        // Prerequisites
        // 1. mousedown on a node (i.e. startNodeUUID is confirmed)
        // 2. mousemove -> start dragging, drawing an connection line, the end of the line is following mouse curser
        //
        // then user mouseup, we need to get endNodeUUID to finish the creation of the new connection
        let startNodeUUID = newConnection.current?.startNodeUUID;

        // ==== startNodeUUID is required, abort if missing

        if (!startNodeUUID) {
          console.error(
            "Failed to make connection. startNodeUUID is undefined."
          );
          return state;
        }

        // ==== user didn't mouseup on a step, abort

        if (!endNodeUUID && newConnection.current) {
          console.error("Failed to make connection. endNodeUUID is undefined.");
          const connectionToRemove = { ...newConnection.current };
          // when deleting connections, it's impossible that user is also creating a new connection
          // thus, we always clean it up.
          newConnection.current = undefined;
          return removeConnection(state, connectionToRemove);
        }

        // ==== check whether there already exists a connection

        const endNodeStep = state.steps[endNodeUUID];
        let alreadyExists = endNodeStep.incoming_connections.includes(
          startNodeUUID
        );

        if (alreadyExists && newConnection.current) {
          const error =
            "These steps are already connected. No new connection has been created.";
          const connectionToRemove = { ...newConnection.current };
          newConnection.current = undefined;
          return { ...removeConnection(state, connectionToRemove), error };
        }

        // ==== check whether connection will create a cycle in Pipeline graph

        let connectionCreatesCycle = willCreateCycle(state.steps, [
          startNodeUUID,
          endNodeUUID,
        ]);

        if (connectionCreatesCycle && newConnection.current) {
          const error =
            "Connecting this step will create a cycle in your pipeline which is not supported.";

          const connectionToRemove = { ...newConnection.current };
          newConnection.current = undefined;
          return { ...removeConnection(state, connectionToRemove), error };
        }

        // ==== Start creating a connection

        // first find the index from the array, at the moment, the connection is incomplete
        newConnection.current = undefined;
        return produce(state, (draft) => {
          const index = draft.connections.findIndex(
            (connection) => !connection.endNodeUUID
          );
          draft.connections[index].endNodeUUID = endNodeUUID;
          if (startNodeUUID)
            draft.steps[endNodeUUID].incoming_connections.push(startNodeUUID);
        });
      };

      const selectSteps = (uuids: string[]) => {
        return {
          selectedConnection: null,
          selectedSteps: uuids,
          openedMultiStep: uuids.length > 1,
        };
      };

      const deselectAllSteps = () => {
        return {
          selectedSteps: [],
          openedMultiStep: false,
          cursorControlledStep: undefined,
          // deselecting will close the detail view
          openedStep: undefined,
        };
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

      if (process.env.NODE_ENV === "development")
        console.log("(Dev Mode) useEventVars: action ", action);

      /**
       * ========================== action handlers
       */
      switch (action.type) {
        case "SET_STEPS": {
          return { ...state, steps: action.payload };
        }
        case "SAVE_STEPS": {
          return withTimestamp({ ...state, steps: action.payload });
        }
        case "CREATE_STEP": {
          const newStep = action.payload;

          if (state.steps[newStep.uuid]) {
            return { ...state, error: "Step already exists" };
          }

          // in case any existing step is on the exact same position
          newStep.meta_data.position = getNewStepPosition(
            newStep.meta_data.position
          );

          const updated = produce(state, (draft) => {
            draft.steps[newStep.uuid] = newStep;
          });

          uiStatesDispatch({ type: "OPEN_STEP_DETAILS" });
          return withTimestamp({
            ...state,
            ...updated,
            openedStep: newStep.uuid,
            ...selectSteps([newStep.uuid]),
          });
        }

        case "DUPLICATE_STEPS": {
          const newSteps = action.payload.map((step) => {
            let newStep = {
              ...state.steps[step],
              uuid: uuidv4(),
              file_path: state.steps[step].file_path.endsWith(".ipynb")
                ? ""
                : state.steps[step].file_path,
              meta_data: {
                ...state.steps[step].meta_data,
                position: getNewStepPosition(
                  state.steps[step].meta_data.position
                ),
              },
            };

            return newStep;
          });
          const updated = produce(state, (draft) => {
            newSteps.forEach((step) => {
              draft.steps[step.uuid] = step;
            });
          });

          uiStatesDispatch({ type: "OPEN_STEP_DETAILS" });

          return withTimestamp({
            ...state,
            ...updated,
            ...selectSteps(newSteps.map((s) => s.uuid)),
          });
        }

        case "ASSIGN_FILE_TO_STEP": {
          const { filePath, stepUuid } = action.payload;
          const updated = produce(state, (draft) => {
            draft.steps[stepUuid].file_path = filePath;
          });
          return withTimestamp({ ...state, ...updated });
        }
        case "SELECT_STEPS": {
          const { uuids, inclusive } = action.payload;
          // cancel all selected steps
          if (uuids.length === 0) {
            uiStatesDispatch({ type: "SET_STEP_SELECTOR_INACTIVE" });
            return { ...state, ...deselectAllSteps() };
          }
          // select only one step and non-inclusive
          // i.e. user intends to open the detail of the step
          if (uuids.length === 1 && !inclusive) {
            return {
              ...state,
              openedStep: uuids[0],
              ...selectSteps(uuids),
            };
          }
          const stepsToSelect = inclusive
            ? [...state.selectedSteps, ...uuids]
            : uuids;
          const uniqueSteps = [...new Set(stepsToSelect)];

          uiStatesDispatch({ type: "CLOSE_STEP_DETAILS" });
          return {
            ...state,
            ...selectSteps(uniqueSteps),
          };
        }
        case "DESELECT_STEPS": {
          const remainder = state.selectedSteps.filter(
            (stepUuid) => !action.payload.includes(stepUuid)
          );
          if (remainder.length > 0) {
            return { ...state, selectedSteps: remainder };
          }
          uiStatesDispatch({ type: "SET_STEP_SELECTOR_INACTIVE" });
          return { ...state, ...deselectAllSteps() };
        }
        case "DESELECT_CONNECTION": {
          return { ...state, selectedConnection: null };
        }

        case "SELECT_CONNECTION": {
          const { startNodeUUID, endNodeUUID } = action.payload;

          const found =
            getConnectionIndexByUUIDs(startNodeUUID, endNodeUUID) !== -1;

          if (!found) {
            console.error("Unable to find the connection to select");
          }
          uiStatesDispatch({ type: "SET_STEP_SELECTOR_INACTIVE" });
          return {
            ...state,
            selectedSteps: [],
            selectedConnection: found ? { startNodeUUID, endNodeUUID } : null,
          };
        }

        case "SET_OPENED_STEP": {
          // action.payload is a valid step UUID
          // i.e. open a step, and this step should also be selected
          return {
            ...state,
            openedStep: action.payload,
            openedMultiStep: false,
            ...(action.payload ? selectSteps([action.payload]) : null),
          };
        }

        case "SET_CURSOR_CONTROLLED_STEP": {
          return { ...state, cursorControlledStep: action.payload };
        }

        // this means that the connection might not yet complete, as endNodeUUID is optional
        // this action creates an instance
        case "INSTANTIATE_CONNECTION": {
          uiStatesDispatch({ type: "SET_STEP_SELECTOR_INACTIVE" });
          return {
            ...state,
            connections: [...state.connections, action.payload],
            selectedSteps: [],
            selectedConnection: null,
          };
        }

        case "MAKE_CONNECTION": {
          return withTimestamp(makeConnection(action.payload));
        }

        case "REMOVE_CONNECTION": {
          newConnection.current = undefined;
          // if endNodeUUID is undefined, it's an aborted new connection
          // no need to send a request to delete it
          const shouldSave = hasValue(action.payload.endNodeUUID);
          const outcome = removeConnection(state, action.payload);

          return shouldSave ? withTimestamp(outcome) : outcome;
        }

        case "REMOVE_STEPS": {
          // also delete incoming connections that contain this uuid
          const stepsToDelete = action.payload;

          const connectionsToDelete = stepsToDelete.reduce(
            (allConnections, uuidToDelete) => {
              // remove the connections between current step and its preceding nodes
              const incomingConnections = state.steps[
                uuidToDelete
              ].incoming_connections.map((startNodeUUID) => {
                return { startNodeUUID, endNodeUUID: uuidToDelete };
              });

              // remove the connections between current step and its subsequent nodes
              const outgoingConnections = Object.entries(state.steps).reduce(
                (all, [uuid, step]) => {
                  const isSubsequent = step.incoming_connections.includes(
                    uuidToDelete
                  );

                  return isSubsequent
                    ? [
                        ...all,
                        { startNodeUUID: uuidToDelete, endNodeUUID: uuid },
                      ]
                    : all;
                },
                [] as Connection[]
              );
              return [
                ...allConnections,
                ...incomingConnections,
                ...outgoingConnections,
              ];
            },
            [] as Connection[]
          );
          newConnection.current = undefined;
          const updatedState: EventVars = connectionsToDelete.reduce(
            (final, connection) => removeConnection(final, connection),
            state
          );

          return produce(withTimestamp(updatedState), (draft) => {
            stepsToDelete.forEach(
              (uuidToDelete) => delete draft.steps[uuidToDelete]
            );

            draft.openedStep = undefined;
            // when removing a step, the selection of any step is also cancelled
            // we can simply clean up state.selectedSteps, instead of remove them one by one
            draft.selectedSteps = [];
          });
        }

        case "SAVE_STEP_DETAILS": {
          const { replace, stepChanges, uuid } = action.payload;
          // Mutate step with changes
          return produce(withTimestamp(state), (draft) => {
            if (replace) {
              // Replace works on the top level keys that are provided
              Object.entries(stepChanges).forEach(([propKey, mutation]) => {
                draft.steps[uuid][propKey] = mutation;
              });
            } else {
              // lodash merge mutates the object
              merge(draft.steps[uuid], stepChanges);
            }
          });
        }

        case "DESELECT_ALL_STEPS": {
          return {
            ...state,
            ...deselectAllSteps(),
          };
        }

        case "SET_ERROR": {
          return { ...state, error: action.payload };
        }

        default: {
          console.error(`[EventVars] Unknown action: "${action}"`);
          return state;
        }
      }
    },
    [uiStatesDispatch]
  );

  const [eventVars, dispatch] = React.useReducer(memoizedReducer, {
    initialized: false,
    doubleClickFirstClick: false,
    openedStep: undefined,
    openedMultiStep: undefined,
    selectedSteps: [],
    cursorControlledStep: undefined,
    steps: {},
    connections: [],
    selectedConnection: null,
    timestamp: undefined,
  });

  // Clear all selected steps when user creates stepSelector.
  React.useEffect(() => {
    if (stepSelector.active) {
      dispatch({ type: "DESELECT_ALL_STEPS" });
    }
  }, [stepSelector.active]);

  // Update selectedSteps while user is dragging stepSelector.
  React.useEffect(() => {
    let rect = getStepSelectorRectangle(stepSelector);
    if (stepSelector.active) {
      dispatch((current) => {
        const selectedSteps: string[] = [];
        Object.values(current.steps).forEach((step) => {
          // guard against ref existing, in case step is being added
          if (stepDomRefs.current[step.uuid]) {
            const stepContainer = stepDomRefs.current[step.uuid];
            let stepRect = {
              x: step.meta_data.position[0],
              y: step.meta_data.position[1],
              width: getOuterWidth(stepContainer),
              height: getOuterHeight(stepContainer),
            };
            if (intersectRect(rect, stepRect)) {
              selectedSteps.push(step.uuid);
            }
          }
        });
        return { type: "SELECT_STEPS", payload: { uuids: selectedSteps } };
      });
    }
  }, [stepSelector.x2, stepSelector.y2]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (eventVars.error) {
      setAlert("Error", eventVars.error, (resolve) => {
        dispatch({ type: "SET_ERROR", payload: null });
        resolve(true);
        return true;
      });
    }
  }, [eventVars.error, setAlert]);

  return {
    eventVars,
    newConnection,
    dispatch,
    stepDomRefs,
    metadataPositions,
  };
};
