import { useJobsApi } from "@/api/jobs/useJobsApi";
import { PipelineMetaData } from "@/types";
import { getUniqueName } from "@/utils/getUniqueName";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useEditJob } from "../stores/useEditJob";
import { useSelectJob } from "./useSelectJob";

export const useCreateJob = (pipeline: PipelineMetaData | undefined) => {
  const { selectJob } = useSelectJob();
  const initJobChanges = useEditJob((state) => state.initJobChanges);
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
      const newJob = await post(uuid, name, newJobName);
      if (newJob) {
        initJobChanges(newJob);
        selectJob(newJob.uuid);
      }
    }
  }, [
    post,
    isAllowedToCreateJob,
    uuid,
    name,
    newJobName,
    selectJob,
    initJobChanges,
  ]);

  return { createJob, isAllowedToCreateJob };
};
