import type { PipelineJson, PipelineStepState } from "@/types";
import cloneDeep from "lodash.clonedeep";

export const updatePipelineJson = (
  pipelineJson: PipelineJson,
  steps: Record<string, PipelineStepState>
): PipelineJson => {
  if (!pipelineJson) return;

  let clonedPipelineJson: PipelineJson = cloneDeep(pipelineJson);
  clonedPipelineJson.steps = {};

  Object.values(steps).forEach((step) => {
    // remove private meta_data (prefixed with underscore)
    Object.keys(step.meta_data).forEach((key) => {
      if (/^_/.test(key)) delete step.meta_data[key];
    });

    // we do not encode outgoing connections explicitly according to
    // pipeline.json spec.
    if (step.outgoing_connections) {
      delete step.outgoing_connections;
    }

    clonedPipelineJson.steps[step.uuid] = step;
  });

  return clonedPipelineJson;
};

export const extractStepsFromPipelineJson = (
  pipelineJson: PipelineJson,
  steps: Record<string, PipelineStepState>
) => {
  Object.entries(pipelineJson.steps).forEach(([key, step]) => {
    steps[key] = {
      ...step,
      // augmenting state with runtime data in meta_data
      meta_data: { ...step.meta_data, _drag_count: 0, _dragged: false },
    };
  });

  return steps;
};
