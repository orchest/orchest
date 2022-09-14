import { useJobsApi } from "@/api/jobs/useJobsApi";
import { useAsync } from "@/hooks/useAsync";
import { JobData, PipelineMetaData } from "@/types";
import { getUniqueName } from "@/utils/getUniqueName";
import { hasValue } from "@orchest/lib-utils";
import React from "react";

export const useCreateJob = (pipeline: PipelineMetaData | undefined) => {
  const { name, uuid: pipelineUuid } = pipeline || {};

  const jobs = useJobsApi((state) => state.jobs || []);
  const post = useJobsApi((state) => state.post);

  const newJobName = React.useMemo(() => {
    return getUniqueName(
      "Job",
      jobs.map((job) => job.name)
    );
  }, [jobs]);

  const { run, status } = useAsync<JobData | undefined>();

  const isAllowedToCreateJob =
    status !== "PENDING" && hasValue(pipelineUuid) && hasValue(name);

  const createJob = React.useCallback(async () => {
    if (isAllowedToCreateJob) {
      const newJob = await run(post(pipelineUuid, name, newJobName));
      return newJob;
    }
  }, [post, isAllowedToCreateJob, pipelineUuid, name, newJobName, run]);

  return { createJob, isAllowedToCreateJob };
};
