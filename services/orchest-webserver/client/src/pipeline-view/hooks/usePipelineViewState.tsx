import React from "react";

export const INITIAL_PIPELINE_POSITION = [-1, -1] as [number, number];

interface PipelineViewState {
  // rendering state
  pipelineOrigin: number[];
  pipelineStepsHolderOffsetLeft: number;
  pipelineStepsHolderOffsetTop: number;
  pipelineOffset: [number, number];
}
let initialState: PipelineViewState = {
  // rendering state
  pipelineOrigin: [0, 0],
  pipelineStepsHolderOffsetLeft: 0,
  pipelineStepsHolderOffsetTop: 0,
  pipelineOffset: INITIAL_PIPELINE_POSITION,
};

const reducer = (
  state: PipelineViewState,
  _mutation:
    | Partial<PipelineViewState>
    | ((current: PipelineViewState) => Partial<PipelineViewState>)
) => {
  const mutation = _mutation instanceof Function ? _mutation(state) : _mutation;
  return { ...state, ...mutation };
};

export const usePipelineViewState = () => {
  const [state, setState] = React.useReducer(reducer, initialState);

  return [state, setState] as const;
};
