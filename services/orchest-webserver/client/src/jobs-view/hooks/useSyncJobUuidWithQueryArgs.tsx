import { useProjectJobsApi } from "@/api/jobs/useProjectJobsApi";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { pickJobChanges } from "../common";
import { useEditJob } from "../stores/useEditJob";

/**
 * Performs a side effect that ensures that the stores load the right job
 * with the given pipeline_uuid and job_uuid in the query args.
 */
export const useSyncJobUuidWithQueryArgs = () => {
  const {
    projectUuid,
    jobUuid: jobUuidFromRoute,
    navigateTo,
  } = useCustomRoute();

  const uuid = useEditJob((state) => state.jobChanges?.uuid);
  const initJobChanges = useEditJob((state) => state.initJobChanges);
  const resetJobChanges = useEditJob((state) => state.resetJobChanges);
  const jobs = useProjectJobsApi((state) => state.jobs);

  const targetJob = React.useMemo(() => {
    const foundJob =
      jobs?.find((job) => job.uuid === jobUuidFromRoute) || jobs?.[0];

    return foundJob;
  }, [jobs, jobUuidFromRoute]);

  const redirect = React.useCallback(
    (jobUuid: string) => {
      resetJobChanges();
      navigateTo(siteMap.jobs.path, {
        query: { projectUuid, jobUuid },
      });
    },
    [navigateTo, projectUuid, resetJobChanges]
  );

  const isJobUuidFromRouteInvalid =
    targetJob && targetJob.uuid !== jobUuidFromRoute;

  const fetchJob = useProjectJobsApi((state) => state.fetchOne);

  const shouldUpdateJobChanges = hasValue(targetJob) && uuid !== targetJob.uuid;

  React.useEffect(() => {
    if (isJobUuidFromRouteInvalid) {
      redirect(targetJob.uuid);
    } else if (shouldUpdateJobChanges) {
      // It is intentional that the response of fetchAll doesn't provide correct env_variable (always `null`).
      // Normally environment variables contain sensitive information like password.
      // Therefore, they are only provided if FE is requesting for one specific job.
      // Therefore, here FE fires another request to fetch the complete job, specifically for its env_variables.
      fetchJob(targetJob.uuid).then((fetchedJob) => {
        const jobChanges = pickJobChanges(fetchedJob);
        if (jobChanges) initJobChanges(jobChanges);
      });
    }
  }, [
    isJobUuidFromRouteInvalid,
    redirect,
    fetchJob,
    targetJob?.uuid,
    shouldUpdateJobChanges,
    initJobChanges,
  ]);
};
