import type { StepsDict, StepState } from "@/types";

export const topologicalSort = (steps: StepsDict) => {
  const sortedStepKeys: string[] = [];

  const conditionalAdd = (step: StepState) => {
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
  let addSelfAndChildren = (step: StepState) => {
    conditionalAdd(step);

    step.outgoing_connections = step.outgoing_connections || ([] as string[]);

    for (const childStepUUID of step.outgoing_connections) {
      let childStep = steps[childStepUUID];

      conditionalAdd(childStep);
    }

    // Recurse down
    for (const childStepUUID of step.outgoing_connections) {
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
