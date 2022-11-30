import { usePipelineDataContext } from "@/pipeline-view/contexts/PipelineDataContext";
import { hasValue } from "@orchest/lib-utils";
import React from "react";

export const useStepConnections = (stepUuid: string | undefined) => {
  const { pipelineJson } = usePipelineDataContext();
  const steps = pipelineJson?.steps;

  return React.useMemo(() => {
    const step = stepUuid ? steps?.[stepUuid] : undefined;

    if (!step) return { incoming: [], outgoing: [] };

    return {
      incoming: step.incoming_connections
        .map((uuid) => steps?.[uuid])
        .filter(hasValue),
      outgoing: step.outgoing_connections
        .map((uuid) => steps?.[uuid])
        .filter(hasValue),
    };
  }, [steps, stepUuid]);
};
