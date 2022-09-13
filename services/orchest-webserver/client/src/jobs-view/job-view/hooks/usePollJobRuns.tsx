import { useInterval } from "@/hooks/use-interval";
import { useEditJob } from "@/jobs-view/stores/useEditJob";
import { useEditJobType } from "./useEditJobType";

export const usePollJobRuns = (refresh: () => Promise<void>) => {
  const jobType = useEditJobType();
  const shouldPollJobRuns = useEditJob(
    (state) =>
      jobType === "active-cronjob" && state.jobChanges?.status !== "PAUSED"
  );
  useInterval(refresh, shouldPollJobRuns ? 5000 : undefined);
};
