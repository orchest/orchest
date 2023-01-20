import { useJobRunsApi } from "@/api/job-runs/useJobRunsApi";
import { useInterval } from "@/hooks/useInterval";
import React from "react";

const getNextFullMinuteTime = () => {
  const baseTime = new Date();
  baseTime.setMinutes(baseTime.getMinutes() + 1);
  // Scheduled runs sometimes start a bit later, depending on the BE capacity.
  baseTime.setSeconds(15);
  return baseTime.getTime();
};

const useRefreshPerMinute = (
  refresh: () => void,
  { disabled }: { disabled: boolean }
) => {
  const [nextRefreshTime, setNextRefreshTime] = React.useState(() =>
    getNextFullMinuteTime()
  );

  React.useEffect(() => {
    if (!disabled) {
      window.setTimeout(() => {
        refresh();
        setNextRefreshTime(getNextFullMinuteTime());
      }, nextRefreshTime - new Date().getTime());
    }
  }, [nextRefreshTime, refresh, disabled]);
};

export const usePollPageJobRuns = (refresh: () => void) => {
  const hasOngoingRuns = useJobRunsApi((state) =>
    state.runs?.some(
      (run) => run.status === "PENDING" || run.status === "STARTED"
    )
  );

  const pageNumber = useJobRunsApi((state) => state.pagination?.page_number);
  const isEnabled = pageNumber === 1;

  // To ensure user see the progress of ongoing jog runs.
  useInterval(
    refresh,
    isEnabled ? (hasOngoingRuns ? 5000 : undefined) : undefined
  );
  // User can schedule a one-off job or a recurring job at a granularity of minutes.
  // Therefore, refreshing per minute is enough.
  useRefreshPerMinute(refresh, { disabled: !isEnabled });
};
