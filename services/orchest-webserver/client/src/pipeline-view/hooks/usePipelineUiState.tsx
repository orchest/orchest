import { useGlobalContext } from "@/contexts/GlobalContext";
import type {
  Connection,
  NewConnection,
  ReducerActionWithCallback,
  StepsDict,
  StepState,
} from "@/types";
import { createRect, Point2D, rectsIntersect } from "@/utils/geometry";
import { getOuterHeight, getOuterWidth } from "@/utils/jquery-replacement";
import { setOutgoingConnections } from "@/utils/webserver-utils";
import { hasValue, uuidv4 } from "@orchest/lib-utils";
import produce from "immer";
import React from "react";
import { createsLoop } from "../common";
import { useCanvasScaling } from "../contexts/CanvasScalingContext";
import { usePipelineRefs } from "../contexts/PipelineRefsContext";

type StepSelectorData = {
  start: Point2D;
  end: Point2D;
  active: boolean;
};

export type ContextMenuUuid = "viewport" | string | undefined;

export type PipelineUiState = {
  steps: StepsDict;
  isStepsLoaded?: boolean;
  connections: Connection[];
  selectedSteps: string[];
  /** The UUID of the step currently controlled by the cursor, or `undefined` if no step is grabbed. */
  grabbedStep: string | undefined;
  selectedConnection: Pick<Connection, "endNodeUUID" | "startNodeUUID"> | null;
  openedMultiStep: boolean;
  openedStep: string | undefined;
  draftJob: string | undefined;
  stepSelector: StepSelectorData;
  error?: string | null;
  hash?: string;
  subViewIndex: number;
  isDeletingSteps: boolean;
  contextMenuUuid?: ContextMenuUuid;
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
      payload: StepState;
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
      type: "SET_DRAFT_JOB";
      payload: string | undefined;
    }
  | {
      type: "SET_CURSOR_CONTROLLED_STEP";
      payload: string | undefined;
    }
  | { type: "CONNECT"; payload: Required<Connection> }
  | {
      type: "INSTANTIATE_CONNECTIONS";
      payload: Connection[];
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
        stepChanges: Partial<StepState>;
        uuid: string;
      };
    }
  | {
      type: "CREATE_SELECTOR";
      payload: Point2D;
    }
  | {
      type: "UPDATE_STEP_SELECTOR";
      payload: Point2D;
    }
  | {
      type: "SET_STEP_SELECTOR_INACTIVE";
    }
  | {
      type: "SET_ERROR";
      payload: string | null;
    }
  | {
      type: "SELECT_SUB_VIEW";
      payload: number;
    }
  | {
      type: "SET_IS_DELETING_STEPS";
      payload: boolean;
    }
  | {
      type: "SET_CONTEXT_MENU_UUID";
      payload: ContextMenuUuid;
    };

export type PipelineUiStateAction =
  | ReducerActionWithCallback<PipelineUiState, Action>
  | undefined;

const DEFAULT_STEP_SELECTOR: StepSelectorData = {
  start: [0, 0],
  end: [0, 0],
  active: false,
};

export function removeConnection(
  current: PipelineUiState,
  { startNodeUUID, endNodeUUID }: Connection | NewConnection
): PipelineUiState {
  const updatedConnections = current.connections.filter(
    (connection) =>
      connection.startNodeUUID !== startNodeUUID ||
      connection.endNodeUUID !== endNodeUUID
  );

  const nextStep = endNodeUUID ? current.steps[endNodeUUID] : undefined;

  const updatedState = {
    ...current,
    connections: updatedConnections,
    selectedConnection: null,
  };

  if (!endNodeUUID || !nextStep) return updatedState;

  // remove it from the incoming_connections of its subsequent nodes
  // we don't have to clean up outgoing_connections
  const subsequentStepIncomingConnections = nextStep.incoming_connections.filter(
    (incomingConnectionUuid) => incomingConnectionUuid !== startNodeUUID
  );

  updatedState.steps = produce(updatedState.steps, (draft) => {
    draft[endNodeUUID].incoming_connections = subsequentStepIncomingConnections;
  });

  updatedState.steps = setOutgoingConnections(updatedState.steps);

  return updatedState;
}

// Update hash to trigger saving to BE
function withHash<T extends Record<string, unknown>>(obj: T) {
  return {
    ...obj,
    hash: uuidv4(),
  };
}

export const usePipelineUiState = () => {
  const { setAlert } = useGlobalContext();
  const { stepRefs, newConnection, zIndexMax } = usePipelineRefs();
  const { scaleFactor } = useCanvasScaling();

  const memoizedReducer = React.useCallback(
    (
      state: PipelineUiState,
      _action: PipelineUiStateAction
    ): PipelineUiState => {
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

      const connect = ({
        startNodeUUID,
        endNodeUUID,
      }: Required<Connection>) => {
        const index = state.connections.findIndex((c) => !c.endNodeUUID);

        return produce(state, (draft) => {
          if (index === -1) {
            draft.connections.push({ startNodeUUID, endNodeUUID });
          } else {
            draft.connections[index].endNodeUUID = endNodeUUID;
          }

          draft.steps[endNodeUUID].incoming_connections.push(startNodeUUID);
          draft.steps[startNodeUUID].outgoing_connections.push(endNodeUUID);
        });
      };

      const makeConnection = (endNodeUUID: string): PipelineUiState => {
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

        const isLoop = createsLoop(state.steps, [startNodeUUID, endNodeUUID]);

        if (isLoop && newConnection.current) {
          const error =
            "Connecting this step will create a cycle in your pipeline which is not supported.";

          const connectionToRemove = { ...newConnection.current };
          newConnection.current = undefined;
          return { ...removeConnection(state, connectionToRemove), error };
        }

        // ==== Start creating a connection

        // first find the index from the array, at the moment, the connection is incomplete
        newConnection.current = undefined;

        return connect({ startNodeUUID, endNodeUUID });
      };

      const selectSteps = (uuids: string[]) => ({
        selectedConnection: null,
        selectedSteps: uuids,
        openedMultiStep: uuids.length > 1,
      });

      const deselectAllSteps = () => {
        return {
          selectedSteps: [],
          stepSelector: DEFAULT_STEP_SELECTOR,
          openedMultiStep: false,
          // deselecting will close the detail view
          openedStep: undefined,
        };
      };

      /**
       * Get position for new step so it doesn't spawn on top of other steps.
       * @param initialPosition Default position of new step.
       * @param baseOffset The offset to use for X and Y.
       */
      const getNewStepPosition = (
        initialPosition: Point2D,
        baseOffset = 15
      ): Point2D => {
        const stepPositions = new Set<string>();
        Object.values(state.steps).forEach((step) => {
          // Make position hashable.
          stepPositions.add(String(step.meta_data.position));
        });

        let position: Point2D = [...initialPosition];

        while (stepPositions.has(String(position))) {
          position = [position[0] + baseOffset, position[1] + baseOffset];
        }

        return position as Point2D;
      };

      const generateConnections = (steps: StepsDict) => {
        zIndexMax.current = Object.keys(steps).length;

        return Object.values(steps).flatMap((step) => {
          const connections = step.incoming_connections.map((startNodeUUID) => {
            return { startNodeUUID, endNodeUUID: step.uuid };
          });
          zIndexMax.current += connections.length;
          return connections;
        });
      };

      // if (process.env.NODE_ENV === "development")
      //   console.log("(Dev Mode) useUiState: action ", action);

      /**
       * ========================== action handlers
       */
      switch (action.type) {
        case "SET_STEPS": {
          const steps = action.payload;
          const connections = generateConnections(action.payload);

          return {
            ...state,
            steps,
            isStepsLoaded: true,
            connections,
            selectedSteps: [],
            selectedConnection: null,
            stepSelector: DEFAULT_STEP_SELECTOR,
          };
        }
        case "SAVE_STEPS": {
          return withHash({ ...state, steps: action.payload });
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

          return withHash({
            ...state,
            ...updated,
            openedStep: newStep.uuid,
            subViewIndex: 0,
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

          return withHash({
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
          return withHash({ ...state, ...updated });
        }

        case "CREATE_SELECTOR": {
          return {
            ...state,
            grabbedStep: undefined,
            selectedSteps: [],
            stepSelector: {
              start: action.payload,
              end: action.payload,
              active: true,
            },
          };
        }
        case "SET_STEP_SELECTOR_INACTIVE": {
          return produce(state, (draft) => {
            draft.stepSelector.active = false;
          });
        }
        case "SELECT_STEPS": {
          const { uuids, inclusive } = action.payload;
          // cancel all selected steps
          if (uuids.length === 0) {
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

          return {
            ...state,
            selectedSteps: [],
            stepSelector: DEFAULT_STEP_SELECTOR,
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

        case "SET_DRAFT_JOB": {
          return {
            ...state,
            draftJob: action.payload,
            openedStep: undefined,
            openedMultiStep: false,
          };
        }

        case "SET_CURSOR_CONTROLLED_STEP": {
          return { ...state, grabbedStep: action.payload };
        }

        case "UPDATE_STEP_SELECTOR": {
          const newRect = { ...state.stepSelector, end: action.payload };
          const rect = createRect(newRect.start, action.payload);

          return produce(state, (draft) => {
            draft.stepSelector = newRect;

            // for each step perform intersect
            if (newRect.active) {
              draft.selectedSteps = [];
              Object.values(state.steps).forEach((step) => {
                // guard against ref existing, in case step is being added
                const stepContainer = stepRefs.current[step.uuid];

                if (stepContainer) {
                  const stepRect = {
                    origin: step.meta_data.position,
                    width: getOuterWidth(stepContainer),
                    height: getOuterHeight(stepContainer),
                  };

                  if (rectsIntersect(rect, stepRect)) {
                    draft.selectedSteps.push(step.uuid);
                  }
                }
              });
            }
          });
        }

        // this means that the connection might not yet complete, as endNodeUUID is optional
        // this action creates an instance
        case "INSTANTIATE_CONNECTION": {
          return {
            ...state,
            connections: [...state.connections, action.payload],
            selectedSteps: [],
            selectedConnection: null,
            stepSelector: DEFAULT_STEP_SELECTOR,
          };
        }

        case "CONNECT":
          return withHash(connect(action.payload));
        case "MAKE_CONNECTION":
          return withHash(makeConnection(action.payload));

        case "REMOVE_CONNECTION": {
          newConnection.current = undefined;
          // if endNodeUUID is undefined, it's an aborted new connection
          // no need to send a request to delete it
          const shouldSave = hasValue(action.payload.endNodeUUID);
          const outcome = removeConnection(state, action.payload);

          return shouldSave ? withHash(outcome) : outcome;
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
          const updatedState: PipelineUiState = connectionsToDelete.reduce(
            (final, connection) => removeConnection(final, connection),
            state
          );

          return produce(withHash(updatedState), (draft) => {
            stepsToDelete.forEach(
              (uuidToDelete) => delete draft.steps[uuidToDelete]
            );

            draft.openedStep = undefined;
            // when removing a step, the selection of any step is also cancelled
            // we can simply clean up state.selectedSteps, instead of remove them one by one
            draft.selectedSteps = [];
          });
        }

        case "SAVE_STEP_DETAILS":
          const { stepChanges, uuid } = action.payload;

          return produce(withHash(state), (draft) => {
            Object.entries(stepChanges).forEach(
              ([key, value]) => (draft.steps[uuid][key] = value)
            );
          });
        case "SET_ERROR":
          return { ...state, error: action.payload };
        case "SELECT_SUB_VIEW":
          return { ...state, subViewIndex: action.payload };
        case "SET_IS_DELETING_STEPS":
          return { ...state, isDeletingSteps: action.payload };
        case "SET_CONTEXT_MENU_UUID":
          return { ...state, contextMenuUuid: action.payload };
        default: {
          console.error(
            `[UiState] Unknown action: "${JSON.stringify(action)}"`
          );
          return state;
        }
      }
    },
    [newConnection, scaleFactor, stepRefs, zIndexMax]
  );

  const [uiState, uiStateDispatch] = React.useReducer(memoizedReducer, {
    openedStep: undefined,
    openedMultiStep: false,
    draftJob: undefined,
    selectedSteps: [],
    grabbedStep: undefined,
    stepSelector: {
      active: false,
      start: [0, 0],
      end: [0, 0],
    },
    steps: {},
    connections: [],
    selectedConnection: null,
    subViewIndex: 0,
    isDeletingSteps: false,
  });

  React.useEffect(() => {
    if (uiState.error) {
      setAlert("Error", uiState.error, (resolve) => {
        uiStateDispatch({ type: "SET_ERROR", payload: null });
        resolve(true);
        return true;
      });
    }
  }, [uiState.error, setAlert]);

  return {
    uiState,
    uiStateDispatch,
  };
};
