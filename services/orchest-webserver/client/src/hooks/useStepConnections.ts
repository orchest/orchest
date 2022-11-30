import { usePipelineDataContext } from "@/pipeline-view/contexts/PipelineDataContext";
import React from "react";

export const useStepConnections = (stepUuid: string) => {
  const { pipelineJson } = usePipelineDataContext();
  const steps = pipelineJson?.steps;

  return React.useMemo(() => {
    const step = steps?.[stepUuid];

    if (!step) return { incoming: [], outgoing: [] };

    return {
      incoming: step.incoming_connections.map((uuid) => steps[uuid]),
      outgoing: step.outgoing_connections.map((uuid) => steps[uuid]),
    };
  }, [steps, stepUuid]);
};
