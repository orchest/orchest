import { useJobsApi } from "@/api/jobs/useJobsApi";
import { pipelinePathToJsonLocation } from "@/utils/webserver-utils";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useParameterReservedKey } from "../job-view/hooks/useParameterReservedKey";
import { useEditJob } from "../stores/useEditJob";
import { useValidJobQueryArgs } from "./useValidJobQueryArgs";

/**
 * Returns a function that reads a `*.parameters.json` file in the file system,
 * and overwrites `jobChanges.strategy_json` in `useEditJob` store.
 */
export const useReadParameterStrategyFile = () => {
  const { projectUuid, jobUuid } = useValidJobQueryArgs();
  const isDraft = useEditJob((state) => state.jobChanges?.status === "DRAFT");
  const pipelinePath = useEditJob((state) => state.jobChanges?.pipeline_path);
  const pipelineUuid = useEditJob((state) => state.jobChanges?.pipeline_uuid);
  const pipelineJson = useEditJob(
    (state) => state.jobChanges?.pipeline_definition
  );

  const isAllowedToFetch =
    hasValue(projectUuid) &&
    hasValue(pipelineUuid) &&
    hasValue(jobUuid) &&
    hasValue(pipelineJson) &&
    hasValue(pipelinePath) &&
    isDraft;

  const { reservedKey } = useParameterReservedKey();

  const readParameterStrategyFile = useJobsApi(
    (state) => state.fetchParameterStrategy
  );
  const setJobChanges = useEditJob((state) => state.setJobChanges);
  const readParameterStrategyFileForJob = React.useCallback(
    async (path?: string) => {
      if (!isAllowedToFetch) return;

      const paramFilePath = path || pipelinePathToJsonLocation(pipelinePath);
      const fetchedStrategy = await readParameterStrategyFile({
        projectUuid,
        pipelineUuid,
        jobUuid,
        pipelineJson,
        reservedKey,
        paramFilePath,
      });

      if (fetchedStrategy) {
        setJobChanges({
          strategy_json: fetchedStrategy,
          loadedStrategyFilePath: paramFilePath,
        });
      }

      return fetchedStrategy;
    },
    [
      readParameterStrategyFile,
      isAllowedToFetch,
      reservedKey,
      setJobChanges,
      jobUuid,
      pipelineJson,
      pipelinePath,
      pipelineUuid,
      projectUuid,
    ]
  );

  return readParameterStrategyFileForJob;
};
