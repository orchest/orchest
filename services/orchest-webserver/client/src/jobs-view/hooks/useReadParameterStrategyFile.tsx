import { getDefaultParamFilePath } from "@/api/jobs/jobsApi";
import { useJobsApi } from "@/api/jobs/useJobsApi";
import { useGlobalContext } from "@/contexts/GlobalContext";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useEditJob } from "../stores/useEditJob";
import { useGetJobData } from "./useGetJobData";
import { useValidJobQueryArgs } from "./useValidJobQueryArgs";

/**
 * Returns a function that reads a `*.parameters.json` file in the file system,
 * and overwrites `jobChanges.strategy_json` in `useEditJob` store.
 */
export const useReadParameterStrategyFile = () => {
  const jobData = useGetJobData();
  const { projectUuid, jobUuid } = useValidJobQueryArgs();

  const isAllowedToFetch =
    hasValue(projectUuid) &&
    hasValue(jobUuid) &&
    hasValue(jobData) &&
    jobData.status === "DRAFT";

  const { config } = useGlobalContext();
  const reservedKey = config?.PIPELINE_PARAMETERS_RESERVED_KEY;

  const readParameterStrategyFile = useJobsApi(
    (state) => state.fetchParameterStrategy
  );
  const setJobChanges = useEditJob((state) => state.setJobChanges);
  const readParameterStrategyFileForJob = React.useCallback(
    async (path?: string) => {
      if (!isAllowedToFetch) return;

      const resolvedPath = path || getDefaultParamFilePath(jobData);
      const fetchedStrategy = await readParameterStrategyFile(
        jobData,
        reservedKey,
        resolvedPath
      );

      if (fetchedStrategy) {
        setJobChanges({
          strategy_json: fetchedStrategy,
          loadedStrategyFilePath: resolvedPath,
        });
      }

      return fetchedStrategy;
    },
    [
      readParameterStrategyFile,
      isAllowedToFetch,
      reservedKey,
      jobData,
      setJobChanges,
    ]
  );

  return readParameterStrategyFileForJob;
};
