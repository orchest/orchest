import { Point2D } from "@/types";
import React from "react";

export const INITIAL_PIPELINE_POSITION = [-1, -1] as [number, number];

type PanningState = "ready-to-pan" | "panning" | "idle";

export type PipelineCanvasState = {
  pipelineOrigin: Point2D;
  pipelineOffset: Point2D;
  pipelineStepsHolderOffsetLeft: number;
  pipelineStepsHolderOffsetTop: number;
  panningState: PanningState;
};

const initialState: PipelineCanvasState = {
  pipelineOrigin: [0, 0],
  pipelineStepsHolderOffsetLeft: 0,
  pipelineStepsHolderOffsetTop: 0,
  pipelineOffset: INITIAL_PIPELINE_POSITION,
  panningState: "idle",
};

const reducer = (
  state: PipelineCanvasState,
  _mutation:
    | Partial<PipelineCanvasState>
    | ((current: PipelineCanvasState) => Partial<PipelineCanvasState>)
) => {
  const mutation = _mutation instanceof Function ? _mutation(state) : _mutation;
  return { ...state, ...mutation };
};

export const usePipelineCanvasState = () => {
  const [state, setState] = React.useReducer(reducer, initialState);

  return [state, setState] as const;
};
