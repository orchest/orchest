import { useJobsApi } from "@/api/jobs/useJobsApi";
import { useGlobalContext } from "@/contexts/GlobalContext";
import { useHasChanged } from "@/hooks/useHasChanged";
import { useFetchStrategyJson } from "@/jobs-view/hooks/useFetchStrategyJson";
import { useGetJobData } from "@/jobs-view/hooks/useGetJobData";
import { useValidJobQueryArgs } from "@/jobs-view/hooks/useValidJobQueryArgs";
import { useEditJob } from "@/jobs-view/stores/useEditJob";
import { generateStrategyJson } from "@/utils/webserver-utils";
import { hasValue } from "@orchest/lib-utils";
import React from "react";

export const useLoadParameterStrategy = () => {
  const { config } = useGlobalContext();
  const reservedKey = config?.PIPELINE_PARAMETERS_RESERVED_KEY;

  const { projectUuid, jobUuid } = useValidJobQueryArgs();

  const hasLoadedRequiredData =
    hasValue(projectUuid) && hasValue(jobUuid) && hasValue(reservedKey);

  const hasLoadedParameterStrategy = useJobsApi(
    (state) => state.hasLoadedParameterStrategyFile
  );

  const jobData = useGetJobData();
  const isDraft = jobData?.status === "DRAFT";

  const shouldLoadParameterStrategy =
    isDraft && hasLoadedRequiredData && !hasLoadedParameterStrategy;

  const fetchParameterStrategy = useFetchStrategyJson();

  React.useEffect(() => {
    if (shouldLoadParameterStrategy) {
      fetchParameterStrategy();
    }
  }, [shouldLoadParameterStrategy, fetchParameterStrategy]);

  const pipelineJson = jobData?.pipeline_definition;
  const setJobChanges = useEditJob((state) => state.setJobChanges);
  const loadParameterStrategyToJobChanges = React.useCallback(() => {
    if (!jobData || !pipelineJson) return;
    // Do not generate another strategy_json if it has been defined
    // already.
    const strategyJson =
      isDraft && Object.keys(jobData.strategy_json).length === 0
        ? generateStrategyJson(pipelineJson, reservedKey)
        : jobData?.strategy_json;
    setJobChanges({ strategy_json: strategyJson });
  }, [reservedKey, jobData, isDraft, pipelineJson, setJobChanges]);

  const shouldUpdateJobChanges = useHasChanged(
    hasLoadedParameterStrategy,
    (prev, curr) => !prev && curr === true
  );
  React.useEffect(() => {
    if (shouldUpdateJobChanges) {
      loadParameterStrategyToJobChanges();
    }
  }, [shouldUpdateJobChanges, loadParameterStrategyToJobChanges]);

  const resetHasLoadedParameterStrategyFile = useJobsApi(
    (state) => state.resetHasLoadedParameterStrategyFile
  );

  React.useEffect(() => {
    return () => resetHasLoadedParameterStrategyFile();
  }, [resetHasLoadedParameterStrategyFile]);

  return { loadParameterStrategy: fetchParameterStrategy };
};
