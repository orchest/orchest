import { useJobsApi } from "@/api/jobs/useJobsApi";
import { useAsync } from "@/hooks/useAsync";
import { JobData } from "@/types";
import React from "react";
import { pickJobChanges } from "../common";
import { useEditJob } from "../stores/useEditJob";

export const useSetJobPipelineUuid = () => {
  const putJobPipelineUuid = useJobsApi((state) => state.putJobPipelineUuid);
  const { run, status } = useAsync<JobData>();
  const fetchJob = useJobsApi((state) => state.fetchOne);
  const initJobChanges = useEditJob((state) => state.initJobChanges);
  const jobPipelineUuid = useEditJob(
    (state) => state.jobChanges?.pipeline_uuid
  );

  const previousPipelineUuid = React.useRef(jobPipelineUuid);

  const setPipelineUuid = React.useCallback(
    async (jobUuid: string, pipelineUuid: string) => {
      if (previousPipelineUuid.current !== pipelineUuid) {
        await putJobPipelineUuid(jobUuid, pipelineUuid);
        // After pipeline_uuid is changed, the data that is related to the pipeline are also changed.
        // Re-fetch from BE to ensure data correctness.
        await run(fetchJob(jobUuid)).then((fetchedJob) => {
          const jobChanges = pickJobChanges(fetchedJob);
          if (jobChanges) {
            initJobChanges(jobChanges);
            previousPipelineUuid.current === fetchedJob?.pipeline_uuid;
          }
        });
      }
    },
    [putJobPipelineUuid, fetchJob, initJobChanges, run]
  );

  return { setPipelineUuid, isChangingPipelineUuid: status === "PENDING" };
};
