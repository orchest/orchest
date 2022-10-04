import { useHasChanged } from "@/hooks/useHasChanged";
import { generateJobParameters, PipelineRunRow } from "@/jobs-view/common";
import { useEditJob } from "@/jobs-view/stores/useEditJob";
import { Json } from "@/types";
import { hasValue } from "@orchest/lib-utils";
import cloneDeep from "lodash.clonedeep";
import React from "react";
import { useIsEditingActiveCronJob } from "./useIsEditingActiveCronJob";

const findParameterization = (
  parameterization: Record<string, any>, // eslint-disable-line @typescript-eslint/no-explicit-any
  parameters: Record<string, Json>[]
) => {
  const JSONstring = JSON.stringify(parameterization);
  for (let x = 0; x < parameters.length; x++) {
    if (JSON.stringify(parameters[x]) === JSONstring) {
      return x;
    }
  }
  return -1;
};

const parseParameters = (
  parameters: Record<string, Json>[],
  generatedPipelineRuns: Record<string, Json>[]
): string[] => {
  const parametersCopy = cloneDeep(parameters);
  const selectedIndices = new Set<string>();
  generatedPipelineRuns.forEach((run, index) => {
    const encodedParameterization = generateJobParameters([run], ["0"])[0];

    const needleIndex = findParameterization(
      encodedParameterization,
      parametersCopy
    );
    if (needleIndex >= 0) {
      selectedIndices.add(index.toString());
      // remove found parameterization from _parameters, as to not count duplicates
      parametersCopy.splice(needleIndex, 1);
    } else {
      selectedIndices.delete(index.toString());
    }
  });

  return Array.from(selectedIndices);
};

/**
 * Load saved parameters from BE when on mount.
 */
const useInitializeParameters = (
  pipelineRuns: Record<string, Json>[] | undefined,
  setSelectedRuns: React.Dispatch<React.SetStateAction<string[]>>,
  allPipelineRuns: string[]
) => {
  const initialParameters = useEditJob(
    (state) => state.jobChanges?.parameters,
    (existingValue) => hasValue(existingValue)
  );

  const savedSelectedRuns = React.useMemo(() => {
    if (!initialParameters || !pipelineRuns) return undefined;
    return parseParameters(initialParameters, pipelineRuns);
  }, [initialParameters, pipelineRuns]);

  const hasInitiated = React.useRef(false);

  React.useLayoutEffect(() => {
    if (savedSelectedRuns && !hasInitiated.current) {
      hasInitiated.current = true;
      setSelectedRuns(
        savedSelectedRuns.length > 0 ? savedSelectedRuns : allPipelineRuns
      );
    }
  }, [savedSelectedRuns, allPipelineRuns, setSelectedRuns]);

  return hasInitiated;
};

const useSelectAllRunsPerStrategyChange = (
  hasInitiated: React.MutableRefObject<boolean>,
  setSelectedRuns: React.Dispatch<React.SetStateAction<string[]>>,
  allPipelineRuns: string[]
) => {
  // Automatically select all runs when user updates parameters.
  // This is only triggered when the initial parameters are loaded.

  const { isEditingActiveCronJob } = useIsEditingActiveCronJob();

  const strategyJson = useEditJob((state) =>
    isEditingActiveCronJob
      ? state.cronJobChanges?.strategy_json
      : state.jobChanges?.strategy_json
  );

  const hasUpdatedStrategyJson = useHasChanged(
    strategyJson,
    (prev, curr) => hasValue(prev) && prev !== curr
  );

  React.useLayoutEffect(() => {
    if (hasInitiated.current && hasUpdatedStrategyJson) {
      setSelectedRuns(allPipelineRuns);
    }
  }, [allPipelineRuns, hasInitiated, hasUpdatedStrategyJson, setSelectedRuns]);
};

/**
 * Save the changes of selected runs.
 * Loads saved runs from BE on mount, and automatically select all runs when strategy_json is updated.
 */
export const useSelectedRuns = (
  pipelineRuns: Record<string, Json>[] | undefined,
  pipelineRunRows: PipelineRunRow[]
) => {
  const [selectedRuns, setSelectedRuns] = React.useState<string[]>([]);
  const setJobChanges = useEditJob((state) => state.setJobChanges);

  const allPipelineRuns = React.useMemo(() => {
    return pipelineRunRows.map((row) => row.uuid);
  }, [pipelineRunRows]);

  const hasInitiated = useInitializeParameters(
    pipelineRuns,
    setSelectedRuns,
    allPipelineRuns
  );

  useSelectAllRunsPerStrategyChange(
    hasInitiated,
    setSelectedRuns,
    allPipelineRuns
  );

  // Update jobChanges when user (de)select a run.
  React.useEffect(() => {
    if (pipelineRuns && hasInitiated.current) {
      setJobChanges({
        parameters: generateJobParameters(pipelineRuns, selectedRuns),
      });
    }
  }, [pipelineRuns, selectedRuns, setJobChanges, hasInitiated]);

  return [selectedRuns, setSelectedRuns] as const;
};
