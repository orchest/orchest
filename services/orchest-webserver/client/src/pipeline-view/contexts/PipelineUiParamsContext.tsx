import {
  MouseTracker,
  Offset,
  Position,
  ReducerActionWithCallback,
} from "@/types";
import { getOffset } from "@/utils/jquery-replacement";
import React from "react";
import {
  DEFAULT_SCALE_FACTOR,
  getScaleCorrectedPosition,
  scaleCorrected,
} from "../common";

export type PipelineUiParams = {
  scaleFactor: number;
  stepSelector: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    active: boolean;
  };
  shouldAutoFocus: boolean;
  subViewIndex: number;
};

export type Action =
  | {
      type: "SET_SCALE_FACTOR";
      payload: number;
    }
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
    };

export type PipelineUiParamsAction =
  | ReducerActionWithCallback<PipelineUiParams, Action>
  | undefined;

const DEFAULT_STEP_SELECTOR = {
  x1: Number.MIN_VALUE,
  y1: Number.MIN_VALUE,
  x2: Number.MIN_VALUE,
  y2: Number.MIN_VALUE,
  active: false,
};

export type PipelineUiParamsContextType = {
  mouseTracker: React.MutableRefObject<MouseTracker>;
  trackMouseMovement: (clientX: number, clientY: number) => void;
  uiParams: PipelineUiParams;
  uiParamsDispatch: React.Dispatch<PipelineUiParamsAction>;
  pipelineCanvasRef: React.MutableRefObject<HTMLDivElement | null>;
  pipelineViewportRef: React.MutableRefObject<HTMLDivElement | null>;
  getOnCanvasPosition: (offset?: Position) => Position;
  keysDown: Set<number | string>;
};

export const PipelineUiParamsContext = React.createContext<
  PipelineUiParamsContextType
>({} as PipelineUiParamsContextType);

export const usePipelineUiParamsContext = () =>
  React.useContext(PipelineUiParamsContext);

export const PipelineUiParamsContextProvider: React.FC = ({ children }) => {
  const mouseTracker = React.useRef<MouseTracker>({
    client: { x: 0, y: 0 },
    prev: { x: 0, y: 0 },
    delta: { x: 0, y: 0 },
    unscaledPrev: { x: 0, y: 0 },
    unscaledDelta: { x: 0, y: 0 },
  });

  const memoizedReducer = React.useCallback(
    (
      state: PipelineUiParams,
      _action: PipelineUiParamsAction
    ): PipelineUiParams => {
      const action = _action instanceof Function ? _action(state) : _action;

      if (!action) return state;

      switch (action.type) {
        case "SET_SCALE_FACTOR": {
          return {
            ...state,
            scaleFactor: Math.min(Math.max(action.payload, 0.25), 2),
          };
        }

        case "CREATE_SELECTOR": {
          // not dragging the canvas, so user must be creating a selection rectangle
          // NOTE: this also deselect all steps
          const selectorOrigin = getScaleCorrectedPosition({
            offset: action.payload,
            position: mouseTracker.current.client,
            scaleFactor: state.scaleFactor,
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
            scaleFactor: state.scaleFactor,
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

        default: {
          console.error(`[PipelineUiParams] Unknown action: "${action}"`);
          return state;
        }
      }
    },
    []
  );

  const [uiParams, uiParamsDispatch] = React.useReducer(memoizedReducer, {
    stepSelector: {
      active: false,
      x1: 0,
      y1: 0,
      x2: 0,
      y2: 0,
    },
    scaleFactor: DEFAULT_SCALE_FACTOR,
    subViewIndex: 0,
    shouldAutoFocus: false,
  });

  // this function doesn't trigger update, it simply persists clientX clientY for calculation
  const trackMouseMovement = React.useCallback(
    (clientX: number, clientY: number) => {
      mouseTracker.current.client = { x: clientX, y: clientY };

      // get the distance of the movement, and update prevPosition
      const previous = mouseTracker.current.prev;

      mouseTracker.current.delta = {
        x: scaleCorrected(clientX, uiParams.scaleFactor) - previous.x,
        y: scaleCorrected(clientY, uiParams.scaleFactor) - previous.y,
      };

      mouseTracker.current.prev = {
        x: scaleCorrected(clientX, uiParams.scaleFactor),
        y: scaleCorrected(clientY, uiParams.scaleFactor),
      };

      const unscaledPrev = mouseTracker.current.unscaledPrev;

      mouseTracker.current.unscaledDelta = {
        x: clientX - unscaledPrev.x,
        y: clientY - unscaledPrev.y,
      };

      mouseTracker.current.unscaledPrev = {
        x: clientX,
        y: clientY,
      };
    },
    [uiParams.scaleFactor, mouseTracker]
  );

  React.useEffect(() => {
    const startTracking = (e: MouseEvent) =>
      trackMouseMovement(e.clientX, e.clientY);
    document.body.addEventListener("mousemove", startTracking);
    return () => document.body.removeEventListener("mousemove", startTracking);
  }, [trackMouseMovement]);

  const pipelineCanvasRef = React.useRef<HTMLDivElement | null>(null);
  const pipelineViewportRef = React.useRef<HTMLDivElement | null>(null);

  const getOnCanvasPosition = React.useCallback(
    (offset: Position = { x: 0, y: 0 }): Position => {
      const clientPosition = {
        x: mouseTracker.current.client.x - offset.x,
        y: mouseTracker.current.client.y - offset.y,
      };
      const { x, y } = getScaleCorrectedPosition({
        offset: getOffset(pipelineCanvasRef.current),
        position: clientPosition,
        scaleFactor: uiParams.scaleFactor,
      });

      return { x, y };
    },
    [uiParams.scaleFactor, mouseTracker, pipelineCanvasRef]
  );

  const keysDown = React.useMemo<Set<number>>(() => new Set(), []);

  return (
    <PipelineUiParamsContext.Provider
      value={{
        mouseTracker,
        keysDown,
        trackMouseMovement,
        uiParams,
        uiParamsDispatch,
        pipelineCanvasRef,
        pipelineViewportRef,
        getOnCanvasPosition,
      }}
    >
      {children}
    </PipelineUiParamsContext.Provider>
  );
};
