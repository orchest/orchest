import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useHasChanged } from "@/hooks/useHasChanged";
import { useInteractiveRunsContext } from "@/pipeline-view/contexts/InteractiveRunsContext";
import { usePipelineDataContext } from "@/pipeline-view/contexts/PipelineDataContext";
import { usePipelineEditorContext } from "@/pipeline-view/contexts/PipelineEditorContext";
import { RunStepsType } from "@/pipeline-view/hooks/useInteractiveRuns";
import React from "react";

export const useRunSteps = () => {
  const { jobUuid } = useCustomRoute();
  const { runUuid } = usePipelineDataContext();
  const {
    eventVars: { selectedSteps, steps },
  } = usePipelineEditorContext();
  const {
    pipelineRunning,
    runSteps,
    cancelRun,
    isCancellingRun,
  } = useInteractiveRunsContext();

  const doCancelRun = React.useCallback(() => {
    return cancelRun({ jobUuid, runUuid });
  }, [jobUuid, runUuid]);

  const doRunSteps = React.useCallback(
    (stepsToRun: string[], type: RunStepsType) => {
      if (!pipelineRunning) runSteps(stepsToRun, type);
    },
    [pipelineRunning, runSteps]
  );

  const allSteps = Object.keys(steps);
  const shouldRunAll =
    selectedSteps.length === 0 || selectedSteps.length === allSteps.length;

  // Only re-create runAllSteps if the UUID of all steps are changed.
  // Strict equality is not needed. In practice, user is not able to delete one step and create a new step
  // in one operation. Comparing the length of the keys is enough.
  const hasAllStepsChanged = useHasChanged(
    allSteps,
    (prev, curr) => prev?.length !== curr.length
  );

  const runAllSteps = React.useCallback(() => {
    doRunSteps(allSteps, "selection");
  }, [hasAllStepsChanged, doRunSteps]); // eslint-disable-line react-hooks/exhaustive-deps

  const runSelectedSteps = React.useCallback(() => {
    doRunSteps(selectedSteps, "selection");
  }, [doRunSteps, selectedSteps]);

  const runIncomingSteps = React.useCallback(() => {
    doRunSteps(selectedSteps, "incoming");
  }, [doRunSteps, selectedSteps]);

  return {
    pipelineRunning,
    isCancellingRun,
    shouldRunAll,
    runIncomingSteps: selectedSteps.length > 0 ? runIncomingSteps : undefined,
    runSelectedSteps: selectedSteps.length > 0 ? runSelectedSteps : undefined,
    runAllSteps: allSteps.length > 0 ? runAllSteps : undefined,
    cancelRun: doCancelRun,
  };
};
