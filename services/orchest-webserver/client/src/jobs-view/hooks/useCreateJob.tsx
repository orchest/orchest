import { useJobsApi } from "@/api/jobs/useJobsApi";
import { useGlobalContext } from "@/contexts/GlobalContext";
import { useAsync } from "@/hooks/useAsync";
import { JobData, PipelineMetaData } from "@/types";
import { getUniqueName } from "@/utils/getUniqueName";
import { hasValue } from "@orchest/lib-utils";
import React from "react";

export const useCreateJob = (pipeline: PipelineMetaData | undefined) => {
  const { setAlert } = useGlobalContext();
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
      try {
        const newJob = await run(post(pipelineUuid, name, newJobName));
        return newJob;
      } catch (error) {
        setAlert("Notice", `Unable to create a new Job. ${error.message}`);
      }
    }
  }, [
    post,
    isAllowedToCreateJob,
    pipelineUuid,
    name,
    newJobName,
    run,
    setAlert,
  ]);

  return { createJob, isAllowedToCreateJob };
};
