import { Offset, ReducerActionWithCallback } from "@/types";
import React from "react";
import { getScaleCorrectedPosition } from "../common";
import { usePipelineRefs } from "./PipelineRefsContext";
import { useScaleFactor } from "./ScaleFactorContext";

export type PipelineUiStates = {
  stepSelector: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    active: boolean;
  };
  shouldAutoFocus: boolean;
  subViewIndex: number;
  isDeletingSteps: boolean;
};

export type Action =
  | {
      type: "CREATE_SELECTOR";
      payload: Offset;
    }
  | {
      type: "HIDE_SELECTOR";
      payload: Offset;
    }
  | {
      type: "UPDATE_STEP_SELECTOR";
      payload: Offset;
    }
  | {
      type: "SET_STEP_SELECTOR_INACTIVE";
    }
  | {
      type: "SELECT_SUB_VIEW";
      payload: number;
    }
  | {
      type: "OPEN_STEP_DETAILS";
    }
  | {
      type: "CLOSE_STEP_DETAILS";
    }
  | {
      type: "SET_IS_DELETING_STEPS";
      payload: boolean;
    };

export type PipelineUiStatesAction =
  | ReducerActionWithCallback<PipelineUiStates, Action>
  | undefined;

const DEFAULT_STEP_SELECTOR = {
  x1: Number.MIN_VALUE,
  y1: Number.MIN_VALUE,
  x2: Number.MIN_VALUE,
  y2: Number.MIN_VALUE,
  active: false,
};

export type PipelineUiStatesContextType = {
  uiStates: PipelineUiStates;
  uiStatesDispatch: React.Dispatch<PipelineUiStatesAction>;
};

export const PipelineUiStatesContext = React.createContext<
  PipelineUiStatesContextType
>({} as PipelineUiStatesContextType);

export const usePipelineUiStatesContext = () =>
  React.useContext(PipelineUiStatesContext);

export const PipelineUiStatesContextProvider: React.FC = ({ children }) => {
  const { scaleFactor } = useScaleFactor();
  const { mouseTracker } = usePipelineRefs();

  const memoizedReducer = React.useCallback(
    (
      state: PipelineUiStates,
      _action: PipelineUiStatesAction
    ): PipelineUiStates => {
      const action = _action instanceof Function ? _action(state) : _action;

      if (!action) return state;

      switch (action.type) {
        case "CREATE_SELECTOR": {
          // not dragging the canvas, so user must be creating a selection rectangle
          // NOTE: this also deselect all steps
          const selectorOrigin = getScaleCorrectedPosition({
            offset: action.payload,
            position: mouseTracker.current.client,
            scaleFactor,
          });

          return {
            ...state,
            shouldAutoFocus: false,
            stepSelector: {
              x1: selectorOrigin.x,
              x2: selectorOrigin.x,
              y1: selectorOrigin.y,
              y2: selectorOrigin.y,
              active: true,
            },
          };
        }
        case "SET_STEP_SELECTOR_INACTIVE": {
          return { ...state, stepSelector: DEFAULT_STEP_SELECTOR };
        }

        case "UPDATE_STEP_SELECTOR": {
          const { x, y } = getScaleCorrectedPosition({
            offset: action.payload,
            position: mouseTracker.current.client,
            scaleFactor,
          });

          return {
            ...state,
            stepSelector: { ...state.stepSelector, x2: x, y2: y },
          };
        }

        case "SELECT_SUB_VIEW": {
          return { ...state, subViewIndex: action.payload };
        }

        case "OPEN_STEP_DETAILS": {
          return { ...state, subViewIndex: 0, shouldAutoFocus: true };
        }

        case "CLOSE_STEP_DETAILS": {
          return { ...state, subViewIndex: 0, shouldAutoFocus: false };
        }

        case "SET_IS_DELETING_STEPS": {
          return { ...state, isDeletingSteps: action.payload };
        }

        default: {
          console.error(`[PipelineUiStates] Unknown action: "${action}"`);
          return state;
        }
      }
    },
    [mouseTracker, scaleFactor]
  );

  const [uiStates, uiStatesDispatch] = React.useReducer(memoizedReducer, {
    stepSelector: {
      active: false,
      x1: 0,
      y1: 0,
      x2: 0,
      y2: 0,
    },
    subViewIndex: 0,
    shouldAutoFocus: false,
    isDeletingSteps: false,
  });

  return (
    <PipelineUiStatesContext.Provider value={{ uiStates, uiStatesDispatch }}>
      {children}
    </PipelineUiStatesContext.Provider>
  );
};
