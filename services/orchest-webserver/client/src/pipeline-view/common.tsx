import type {
  Connection,
  Offset,
  PipelineJson,
  Position,
  StepsDict,
} from "@/types";
import cloneDeep from "lodash.clonedeep";

export const PIPELINE_RUN_STATUS_ENDPOINT = "/catch/api-proxy/api/runs/";
export const PIPELINE_JOBS_STATUS_ENDPOINT = "/catch/api-proxy/api/jobs/";

export const DEFAULT_SCALE_FACTOR = 1;
export const DRAG_CLICK_SENSITIVITY = 3;

export const updatePipelineJson = (
  pipelineJson: PipelineJson,
  steps: StepsDict
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
  steps: StepsDict = {}
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

export const createNewConnection = (
  startNodeUUID: string,
  endNodeUUID?: string | undefined
): Connection => {
  return {
    xEnd: undefined,
    yEnd: undefined,
    startNodeUUID,
    endNodeUUID,
    selected: false,
  };
};

export const scaleCorrectedPosition = (
  position: number,
  scaleFactor: number
) => {
  position /= scaleFactor;
  return position;
};

export const localElementPosition = (
  offset: Offset,
  parentOffset: Offset,
  scaleFactor: number
) => {
  return {
    x: scaleCorrectedPosition(offset.left - parentOffset.left, scaleFactor),
    y: scaleCorrectedPosition(offset.top - parentOffset.top, scaleFactor),
  };
};

export const getPositionFromOffset = ({
  position,
  offset,
  scaleFactor,
}: {
  position: Position;
  offset: Offset;
  scaleFactor: number;
}): Position => {
  return {
    x:
      scaleCorrectedPosition(position.x, scaleFactor) -
      scaleCorrectedPosition(offset.left, scaleFactor),
    y:
      scaleCorrectedPosition(position.y, scaleFactor) -
      scaleCorrectedPosition(offset.top, scaleFactor),
  };
};
