import { useJobsApi } from "@/api/jobs/useJobsApi";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import React from "react";

export const useCreateJob = () => {
  const { pipelineUuid } = useCustomRoute();

  const { jobs, post, isPosting } = useJobsApi();

  const createJob = React.useCallback(
    (jobName: string) => {
      if (!isPosting && pipelineUuid) {
        return post(pipelineUuid, pipelineName, jobName);
      }
    },
    [post, isPosting, pipelineName]
  );

  return { createJob, isCreating: isPosting };
};
