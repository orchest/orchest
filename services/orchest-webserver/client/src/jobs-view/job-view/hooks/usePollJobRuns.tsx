import { useJobRunsApi } from "@/api/job-runs/useJobRunsApi";
import { useInterval } from "@/hooks/use-interval";
import React from "react";

const getNextFullMinuteTime = () => {
  const baseTime = new Date();
  baseTime.setMinutes(baseTime.getMinutes() + 1);
  baseTime.setSeconds(1);
  return baseTime.getTime();
};

const useRefreshPerMinute = (refresh: () => void) => {
  const [nextRefreshTime, setNextRefreshTime] = React.useState(() =>
    getNextFullMinuteTime()
  );

  React.useEffect(() => {
    window.setTimeout(() => {
      refresh();
      setNextRefreshTime(getNextFullMinuteTime());
    }, nextRefreshTime - new Date().getTime());
  }, [nextRefreshTime, refresh]);
};

export const usePollPageJobRuns = (refresh: () => void) => {
  const hasOngoingRuns = useJobRunsApi((state) =>
    state.page?.pipeline_runs.some(
      (run) => run.status === "PENDING" || run.status === "STARTED"
    )
  );

  // To ensure user see the progress of ongoing jog runs.
  useInterval(refresh, hasOngoingRuns ? 5000 : undefined);
  // User can schedule a one-off job or a recurring job at a granularity of minutes.
  // Therefore, refreshing per minute is enough.
  useRefreshPerMinute(refresh);
};
