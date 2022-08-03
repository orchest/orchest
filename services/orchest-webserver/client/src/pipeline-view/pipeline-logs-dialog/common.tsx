import type { StepData, StepState } from "@/types";

export const topologicalSort = (
  steps: Record<string, StepData | StepState>
) => {
  const sortedStepKeys: string[] = [];

  const conditionalAdd = (step: StepData | StepState) => {
    // add if all parents are already in the sortedStepKeys
    let parentsAdded = true;

    for (const connection of step.incoming_connections) {
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
  let addSelfAndChildren = (step: StepData | StepState) => {
    conditionalAdd(step);

    const outgoingConnections = (step as StepState).outgoing_connections || [];

    for (const childStepUUID of outgoingConnections) {
      let childStep = steps[childStepUUID];

      conditionalAdd(childStep);
    }

    // Recurse down
    for (const childStepUUID of outgoingConnections) {
      addSelfAndChildren(steps[childStepUUID]);
    }
  };

  // Find roots
  for (const step of Object.values(steps)) {
    if (step.incoming_connections.length == 0) {
      addSelfAndChildren(step);
    }
  }

  return sortedStepKeys.map((stepUUID) => steps[stepUUID]);
};
