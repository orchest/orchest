import { useJobsApi } from "@/api/jobs/useJobsApi";
import { shallowEqualByKey } from "@/environments-view/common";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { hasValue } from "@orchest/lib-utils";

/**
 * Find job according to jobUuid from the query args.
 */
export const useGetJobData = () => {
  const { jobUuid } = useCustomRoute();
  const job = useJobsApi(
    (state) =>
      hasValue(jobUuid)
        ? state.jobs?.find((job) => job.uuid === jobUuid)
        : undefined,
    (a, b) => {
      const isLoadingJob = hasValue(a) && !hasValue(b);
      const isJobChanged =
        hasValue(a) &&
        hasValue(b) &&
        !shallowEqualByKey(a, b, ["uuid", "project_uuid", "pipeline_uuid"]);

      return isLoadingJob || isJobChanged;
    }
  );

  return job;
};
