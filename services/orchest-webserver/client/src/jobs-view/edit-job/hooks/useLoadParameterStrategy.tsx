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
  const jobData = useGetJobData();
  const { config } = useGlobalContext();

  const isDraft = jobData?.status === "DRAFT";
  const pipelineJson = jobData?.pipeline_definition;
  const reservedKey = config?.PIPELINE_PARAMETERS_RESERVED_KEY;

  const setJobs = useJobsApi((state) => state.setJobs);
  const fetchParameterStrategy = useFetchStrategyJson();

  const loadDefaultOrExistingParameterStrategy = React.useCallback(() => {
    if (!jobData || !pipelineJson) return;
    // Do not generate another strategy_json if it has been defined
    // already.
    const strategyJson =
      isDraft && Object.keys(jobData.strategy_json).length === 0
        ? generateStrategyJson(pipelineJson, reservedKey)
        : jobData?.strategy_json;

    setJobs((jobs) =>
      jobs.map((job) =>
        job.uuid === jobData.uuid
          ? { ...job, strategy_json: strategyJson }
          : job
      )
    );
  }, [reservedKey, jobData, isDraft, pipelineJson, setJobs]);

  const {
    projectUuid: projectUuidFromRoute,
    jobUuid: jobUuidFromRoute,
  } = useCustomRoute();

  const jobUuid = useEditJob((state) => state.jobChanges?.uuid);
  const projectUuid = useEditJob((state) => state.jobChanges?.project_uuid);

  const hasLoadedRequiredData =
    hasValue(projectUuid) &&
    projectUuid === projectUuidFromRoute &&
    hasValue(jobUuid) &&
    jobUuid === jobUuidFromRoute &&
    hasValue(reservedKey);

  const hasLoadedParameterStrategy = useJobsApi(
    (state) => state.hasLoadedParameterStrategy
  );

  const shouldLoadParameterStrategy =
    hasLoadedRequiredData && !hasLoadedParameterStrategy;

  React.useEffect(() => {
    if (shouldLoadParameterStrategy) {
      fetchParameterStrategy();
    }
  }, [shouldLoadParameterStrategy, fetchParameterStrategy]);

  const hasNoParameterStrategy =
    isDraft &&
    hasLoadedParameterStrategy &&
    hasValue(jobData) &&
    Object.keys(jobData.strategy_json).length === 0;

  React.useEffect(() => {
    if (hasNoParameterStrategy) {
      loadDefaultOrExistingParameterStrategy();
    }
  }, [hasNoParameterStrategy, loadDefaultOrExistingParameterStrategy]);

  const setHasLoadedParameterStrategy = useJobsApi(
    (state) => state.setHasLoadedParameterStrategy
  );

  React.useEffect(() => {
    return () => setHasLoadedParameterStrategy(false);
  }, [setHasLoadedParameterStrategy]);

  return { loadParameterStrategy: fetchParameterStrategy };
};
