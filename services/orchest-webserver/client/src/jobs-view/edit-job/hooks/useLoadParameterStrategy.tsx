import { useJobsApi } from "@/api/jobs/useJobsApi";
import { useGlobalContext } from "@/contexts/GlobalContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useFetchStrategyJson } from "@/jobs-view/hooks/useFetchStrategyJson";
import { useGetJobData } from "@/jobs-view/hooks/useGetJobData";
import { useEditJob } from "@/jobs-view/stores/useEditJob";
import { generateStrategyJson } from "@/utils/webserver-utils";
import { hasValue } from "@orchest/lib-utils";
import React from "react";

export const useLoadParameterStrategy = () => {
  const { config } = useGlobalContext();
  const reservedKey = config?.PIPELINE_PARAMETERS_RESERVED_KEY;

  const jobUuid = useEditJob((state) => state.jobChanges?.uuid);
  const projectUuid = useEditJob((state) => state.jobChanges?.project_uuid);
  const {
    projectUuid: projectUuidFromRoute,
    jobUuid: jobUuidFromRoute,
  } = useCustomRoute();
  const hasLoadedRequiredData =
    hasValue(projectUuid) &&
    projectUuid === projectUuidFromRoute &&
    hasValue(jobUuid) &&
    jobUuid === jobUuidFromRoute &&
    hasValue(reservedKey);

  const hasLoadedParameterStrategy = useJobsApi(
    (state) => state.hasLoadedParameterStrategyFile
  );

  const shouldLoadParameterStrategy =
    hasLoadedRequiredData && !hasLoadedParameterStrategy;

  const fetchParameterStrategy = useFetchStrategyJson();

  React.useEffect(() => {
    if (shouldLoadParameterStrategy) {
      fetchParameterStrategy();
    }
  }, [shouldLoadParameterStrategy, fetchParameterStrategy]);

  const jobData = useGetJobData();

  const isDraft = jobData?.status === "DRAFT";
  const hasNoParameterStrategy =
    isDraft &&
    hasLoadedParameterStrategy &&
    hasValue(jobData) &&
    Object.keys(jobData.strategy_json).length === 0;

  const pipelineJson = jobData?.pipeline_definition;
  const setJobChanges = useEditJob((state) => state.setJobChanges);
  const loadDefaultOrExistingParameterStrategy = React.useCallback(() => {
    if (!jobData || !pipelineJson) return;
    // Do not generate another strategy_json if it has been defined
    // already.
    const strategyJson =
      isDraft && Object.keys(jobData.strategy_json).length === 0
        ? generateStrategyJson(pipelineJson, reservedKey)
        : jobData?.strategy_json;

    setJobChanges({ strategy_json: strategyJson });
  }, [reservedKey, jobData, isDraft, pipelineJson, setJobChanges]);

  React.useEffect(() => {
    if (hasNoParameterStrategy) {
      loadDefaultOrExistingParameterStrategy();
    }
  }, [hasNoParameterStrategy, loadDefaultOrExistingParameterStrategy]);

  const resetHasLoadedParameterStrategyFile = useJobsApi(
    (state) => state.resetHasLoadedParameterStrategyFile
  );

  React.useEffect(() => {
    return () => resetHasLoadedParameterStrategyFile();
  }, [resetHasLoadedParameterStrategyFile]);

  return { loadParameterStrategy: fetchParameterStrategy };
};
