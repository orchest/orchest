import { useJobsApi } from "@/api/jobs/useJobsApi";
import { useGlobalContext } from "@/contexts/GlobalContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useEditJob } from "../stores/useEditJob";
import { useGetJobData } from "./useGetJobData";

export const useFetchStrategyJson = () => {
  const { jobUuid: jobUuidFromRoute } = useCustomRoute();
  const jobData = useGetJobData();
  const jobUuid = useEditJob((state) => state.jobChanges?.uuid);
  const fetchStrategyJson = useJobsApi((state) => state.fetchParameterStrategy);

  const isJobUuidValid =
    hasValue(jobUuid) && jobUuidFromRoute === jobUuid && hasValue(jobData);

  const { config } = useGlobalContext();
  const reservedKey = config?.PIPELINE_PARAMETERS_RESERVED_KEY;

  const fetchStrategyJsonForJob = React.useCallback(async () => {
    if (isJobUuidValid) {
      await fetchStrategyJson(jobData, reservedKey);
    }
  }, [fetchStrategyJson, isJobUuidValid, reservedKey, jobData]);

  return fetchStrategyJsonForJob;
};
