import { jobsApi } from "@/api/jobs/jobsApi";
import { useJobsApi } from "@/api/jobs/useJobsApi";
import { JobData } from "@/types";
import React from "react";
import { useAsync } from "./useAsync";
import { useCurrentQuery } from "./useCustomRoute";

export const useFetchActiveJob = () => {
  const { jobUuid } = useCurrentQuery();
  const [job, setJob] = React.useState<JobData>();
  const jobs = useJobsApi((api) => api.jobs);
  const { status, run } = useAsync<JobData>();

  React.useEffect(() => {
    if (!jobUuid) return;

    const found = jobs?.find(({ uuid }) => uuid === jobUuid);

    if (found) {
      setJob(found);
    } else if (status === "IDLE") {
      run(jobsApi.fetchOne(jobUuid)).then(setJob);
    }
  }, [jobUuid, jobs, run, status]);

  return job;
};
