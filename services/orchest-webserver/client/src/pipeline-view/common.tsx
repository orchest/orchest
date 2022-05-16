import type {
  NewConnection,
  Offset,
  PipelineJson,
  PipelineStepState,
  Position,
  StepsDict,
} from "@/types";
import { getOffset } from "@/utils/jquery-replacement";
import { addOutgoingConnections } from "@/utils/webserver-utils";
import cloneDeep from "lodash.clonedeep";

export const PIPELINE_RUN_STATUS_ENDPOINT = "/catch/api-proxy/api/runs";
export const PIPELINE_JOBS_STATUS_ENDPOINT = "/catch/api-proxy/api/jobs";

export const DEFAULT_SCALE_FACTOR = 1;
export const DRAG_CLICK_SENSITIVITY = 3;

export type FileManagementRoot = "/project-dir" | "/data";

export const treeRoots: FileManagementRoot[] = ["/project-dir", "/data"];

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
      meta_data: step.meta_data,
    };
  });

  return steps;
};

export const instantiateNewConnection = (
  startNodeUUID: string
): NewConnection => {
  return {
    xEnd: undefined,
    yEnd: undefined,
    startNodeUUID,
    endNodeUUID: undefined,
  };
};

export const scaleCorrected = (value: number, scaleFactor: number) => {
  value /= scaleFactor;
  return value;
};

const localElementPosition = (
  offset: Offset,
  parentOffset: Offset,
  scaleFactor: number
): Position => {
  return {
    x: scaleCorrected(offset.left - parentOffset.left, scaleFactor),
    y: scaleCorrected(offset.top - parentOffset.top, scaleFactor),
  };
};

export const getNodeCenter = (parentOffset: Offset, scaleFactor: number) => (
  node: HTMLElement | undefined | null
) => {
  if (!node) return null;
  let nodePosition = localElementPosition(
    getOffset(node),
    parentOffset,
    scaleFactor
  );

  nodePosition.x += node.clientWidth / 2;
  nodePosition.y += node.clientHeight / 2;
  return nodePosition;
};

export const getScaleCorrectedPosition = ({
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
      scaleCorrected(position.x, scaleFactor) -
      scaleCorrected(offset.left, scaleFactor),
    y:
      scaleCorrected(position.y, scaleFactor) -
      scaleCorrected(offset.top, scaleFactor),
  };
};

function dfsWithSets<
  T extends Record<
    string,
    Pick<PipelineStepState, "incoming_connections" | "outgoing_connections">
  >
>(steps: T, step_uuid: string, whiteSet: Set<string>, greySet: Set<string>) {
  // move from white to grey
  whiteSet.delete(step_uuid);
  greySet.add(step_uuid);

  for (let childUuid of steps[step_uuid].outgoing_connections) {
    if (whiteSet.has(childUuid)) {
      if (dfsWithSets(steps, childUuid, whiteSet, greySet)) {
        return true;
      }
    } else if (greySet.has(childUuid)) {
      return true;
    }
  }

  // move from grey to black
  greySet.delete(step_uuid);
}

export const willCreateCycle = (
  _steps: StepsDict,
  newConnection: [string, string]
) => {
  const [startNodeUUID, endNodeUUID] = newConnection;
  // make a new copy of original steps, because we are checking this as a side effect
  // we don't want to mutate the original steps.
  const steps = Object.entries(_steps).reduce((newCopy, [uuid, step]) => {
    return {
      ...newCopy,
      [uuid]: { uuid, incoming_connections: [...step.incoming_connections] },
    };
  }, {} as StepsDict);
  // add new connection
  steps[endNodeUUID].incoming_connections = [
    ...steps[endNodeUUID].incoming_connections,
    startNodeUUID,
  ];

  addOutgoingConnections(steps);

  let whiteSet = new Set(Object.keys(steps));
  let greySet = new Set<string>();

  let cycles = false;

  while (whiteSet.size > 0) {
    // take first element left in whiteSet
    let step_uuid = whiteSet.values().next().value;

    if (dfsWithSets(steps, step_uuid, whiteSet, greySet)) {
      cycles = true;
    }
  }

  return cycles;
};

export const originTransformScaling = (
  origin: [number, number],
  scaleFactor: number
) => {
  /* By multiplying the transform-origin with the scaleFactor we get the right
   * displacement for the transformed/scaled parent (pipelineStepHolder)
   * that avoids visual displacement when the origin of the
   * transformed/scaled parent is modified.
   *
   * the adjustedScaleFactor was derived by analyzing the geometric behavior
   * of applying the css transform: translate(...) scale(...);.
   */

  let adjustedScaleFactor = scaleFactor - 1;
  origin[0] *= adjustedScaleFactor;
  origin[1] *= adjustedScaleFactor;
  return origin;
};
