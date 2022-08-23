import { useJobsApi } from "@/api/jobs/useJobsApi";
import { PipelineMetaData } from "@/types";
import { getUniqueName } from "@/utils/getUniqueName";
import { hasValue } from "@orchest/lib-utils";
import React from "react";

export const useCreateJob = (pipeline: PipelineMetaData | undefined) => {
  const { name, uuid } = pipeline || {};

  const [jobs = [], post, isPosting] = useJobsApi((state) => [
    state.jobs,
    state.post,
    state.isPosting,
  ]);

  const newJobName = React.useMemo(() => {
    return getUniqueName(
      "Job",
      jobs.map((job) => job.name)
    );
  }, [jobs]);

  const isAllowedToCreateJob = !isPosting && hasValue(uuid) && hasValue(name);

  const createJob = React.useCallback(async () => {
    if (isAllowedToCreateJob) {
      return post(uuid, name, newJobName);
    }
  }, [post, isAllowedToCreateJob, uuid, name, newJobName]);

  return { createJob, isAllowedToCreateJob };
};
