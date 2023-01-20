import { useProjectJobsApi } from "@/api/jobs/useProjectJobsApi";
import { useGlobalContext } from "@/contexts/GlobalContext";
import { useAsync } from "@/hooks/useAsync";
import { JobData } from "@/types";
import React from "react";
import { pickJobChanges } from "../common";
import { useEditJob } from "../stores/useEditJob";
import { useValidJobQueryArgs } from "./useValidJobQueryArgs";

export const useUpdateJobPipelineUuid = () => {
  const { setAlert } = useGlobalContext();
  const { jobUuid } = useValidJobQueryArgs();
  const putJobPipelineUuid = useProjectJobsApi(
    (state) => state.putJobPipelineUuid
  );
  const { run, status } = useAsync<JobData>();
  const fetchJob = useProjectJobsApi((state) => state.fetchOne);
  const initJobChanges = useEditJob((state) => state.initJobChanges);
  const jobPipelineUuid = useEditJob(
    (state) => state.jobChanges?.pipeline_uuid
  );

  const setJobChanges = useEditJob((state) => state.setJobChanges);

  const previousPipelineUuid = React.useRef(jobPipelineUuid);

  const changePipelineUuid = React.useCallback(
    async (pipelineUuid: string, pipelinePath: string) => {
      if (!jobUuid) return false;
      try {
        await putJobPipelineUuid(jobUuid, pipelineUuid);
        return true;
      } catch (error) {
        setJobChanges({ pipeline_uuid: previousPipelineUuid.current });
        setAlert(
          "Notice",
          `Unable to use pipeline "${pipelinePath}". ${String(error)}`
        );
        return false;
      }
    },
    [jobUuid, putJobPipelineUuid, setJobChanges, setAlert]
  );

  const setPipelineUuid = React.useCallback(
    async (pipelineUuid: string, pipelinePath: string) => {
      if (jobUuid && previousPipelineUuid.current !== pipelineUuid) {
        const success = await changePipelineUuid(pipelineUuid, pipelinePath);
        if (!success) return;
        // After pipeline_uuid is changed, the data that is related to the pipeline are also changed.
        // Re-fetch from BE to ensure data correctness.
        run(fetchJob(jobUuid)).then((fetchedJob) => {
          const jobChanges = pickJobChanges(fetchedJob);
          if (jobChanges) {
            initJobChanges(jobChanges);
            previousPipelineUuid.current = fetchedJob?.pipeline_uuid;
          }
        });
      }
    },
    [fetchJob, initJobChanges, run, jobUuid, changePipelineUuid]
  );

  return { setPipelineUuid, isChangingPipelineUuid: status === "PENDING" };
};
