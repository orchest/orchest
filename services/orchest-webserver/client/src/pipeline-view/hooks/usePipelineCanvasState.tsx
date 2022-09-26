import { Point2D } from "@/utils/geometry";
import React from "react";
import { CANVAS_PADDING } from "../pipeline-viewport/common";

export const INITIAL_PIPELINE_OFFSET: Point2D = [
  -CANVAS_PADDING,
  -CANVAS_PADDING,
];

type PanningState = "ready-to-pan" | "panning" | "idle";

export type PipelineCanvasState = {
  pipelineOrigin: Point2D;
  pipelineOffset: Point2D;
  pipelineCanvasOffset: Point2D;
  panningState: PanningState;
};

const initialState: PipelineCanvasState = {
  pipelineOrigin: [0, 0],
  pipelineCanvasOffset: [0, 0],
  pipelineOffset: INITIAL_PIPELINE_OFFSET,
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
