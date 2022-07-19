import type { PipelineStepState, Step, StepsDict } from "@/types";
import { addOutgoingConnections } from "@/utils/webserver-utils";

export const topologicalSort = (pipelineSteps: Record<string, Step>) => {
  const sortedStepKeys: string[] = [];

  const mutatedPipelineSteps = addOutgoingConnections(
    pipelineSteps as StepsDict
  );

  const conditionalAdd = (step: PipelineStepState) => {
    // add if all parents are already in the sortedStepKeys
    let parentsAdded = true;
    for (let connection of step.incoming_connections) {
      if (!sortedStepKeys.includes(connection)) {
        parentsAdded = false;
        break;
      }
    }

    if (!sortedStepKeys.includes(step.uuid) && parentsAdded) {
      sortedStepKeys.push(step.uuid);
    }
  };

  // Add self and children (breadth first)
  let addSelfAndChildren = (step: PipelineStepState) => {
    conditionalAdd(step);

    step.outgoing_connections = step.outgoing_connections || ([] as string[]);

    for (let childStepUUID of step.outgoing_connections) {
      let childStep = mutatedPipelineSteps[childStepUUID];

      conditionalAdd(childStep);
    }

    // Recurse down
    for (let childStepUUID of step.outgoing_connections) {
      addSelfAndChildren(mutatedPipelineSteps[childStepUUID]);
    }
  };

  // Find roots
  for (let stepUUID in mutatedPipelineSteps) {
    let step = mutatedPipelineSteps[stepUUID];
    if (step.incoming_connections.length == 0) {
      addSelfAndChildren(step);
    }
  }

  return sortedStepKeys.map((stepUUID) => mutatedPipelineSteps[stepUUID]);
};
