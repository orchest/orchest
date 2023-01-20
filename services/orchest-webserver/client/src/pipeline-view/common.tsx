import {
  NewConnection,
  PipelineJson,
  PipelineJsonState,
  StepNode,
  StepsDict,
  UnidirectionalStepNode,
} from "@/types";
import { omit } from "@/utils/record";
import { setOutgoingConnections } from "@/utils/webserver-utils";

export const DRAG_CLICK_SENSITIVITY = 3;

export const updatePipelineJson = (
  pipelineJson: PipelineJsonState | PipelineJson,
  steps: StepsDict
): PipelineJson => {
  pipelineJson.steps = Object.entries(steps).reduce(
    (newSteps, [stepUuid, step]) => ({
      ...newSteps,
      [stepUuid]: omit(step, "outgoing_connections"),
    }),
    {}
  );

  return pipelineJson;
};

export const instantiateNewConnection = (
  startNodeUUID: string
): NewConnection => {
  return {
    startNodeUUID,
    endNodeUUID: undefined,
  };
};

function depthFirstSearch<N extends StepNode>(
  steps: Record<string, N>,
  step_uuid: string,
  whiteSet: Set<string>,
  greySet: Set<string>
) {
  // move from white to grey
  whiteSet.delete(step_uuid);
  greySet.add(step_uuid);

  for (let childUuid of steps[step_uuid].outgoing_connections || []) {
    if (whiteSet.has(childUuid)) {
      if (depthFirstSearch(steps, childUuid, whiteSet, greySet)) {
        return true;
      }
    } else if (greySet.has(childUuid)) {
      return true;
    }
  }

  // move from grey to black
  greySet.delete(step_uuid);
}

const copyNodes = (steps: StepsDict): Record<string, UnidirectionalStepNode> =>
  Object.fromEntries(
    Object.entries(steps).map(([uuid, step]) => [
      uuid,
      { uuid, incoming_connections: [...step.incoming_connections] },
    ])
  );

export const createsLoop = (
  steps: StepsDict,
  [startNodeUUID, endNodeUUID]: [string, string]
) => {
  // make a new copy of original steps, because we are checking this as a side effect
  // we don't want to mutate the original steps.
  const uniNodes = copyNodes(steps);
  const end = uniNodes[endNodeUUID];
  end.incoming_connections = [...end.incoming_connections, startNodeUUID];
  const nodes = setOutgoingConnections(uniNodes);

  const whiteSet = new Set(Object.keys(nodes));
  const greySet = new Set<string>();

  while (whiteSet.size > 0) {
    const stepUuid = whiteSet.values().next().value;

    if (depthFirstSearch(nodes, stepUuid, whiteSet, greySet)) {
      return true;
    }
  }

  return false;
};
