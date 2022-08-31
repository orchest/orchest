import { useJobsApi } from "@/api/jobs/useJobsApi";
import { useGlobalContext } from "@/contexts/GlobalContext";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useGetJobData } from "./useGetJobData";
import { useValidJobQueryArgs } from "./useValidJobQueryArgs";

export const useFetchStrategyJson = () => {
  const jobData = useGetJobData();

  const fetchStrategyJson = useJobsApi((state) => state.fetchParameterStrategy);

  const { jobUuid } = useValidJobQueryArgs();

  const isJobUuidValid = hasValue(jobUuid) && hasValue(jobData);

  const { config } = useGlobalContext();
  const reservedKey = config?.PIPELINE_PARAMETERS_RESERVED_KEY;

  const fetchStrategyJsonForJob = React.useCallback(async () => {
    if (isJobUuidValid) {
      await fetchStrategyJson(jobData, reservedKey);
    }
  }, [fetchStrategyJson, isJobUuidValid, reservedKey, jobData]);

  return fetchStrategyJsonForJob;
};
