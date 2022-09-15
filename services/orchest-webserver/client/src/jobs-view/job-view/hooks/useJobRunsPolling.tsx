import { useJobRunsApi } from "@/api/job-runs/useJobRunsApi";
import React from "react";

const nextMinute = () => {
  const now = new Date();

  // We schedule each refresh with an offset since:
  // A) there might be an offset in time between the client clock and BE, and
  // B) because scheduled runs may start a bit late if the BE load is high.
  const offset = 15000;

  return now.setMinutes(now.getMinutes() + 1) + offset;
};

export const useJobRunsPolling = (
  refresh: () => void,
  { disabled }: { disabled: boolean }
) => {
  const hasOngoingRuns = useJobRunsApi((state) =>
    state.runs?.some(
      (run) => run.status === "PENDING" || run.status === "STARTED"
    )
  );
  const pageNumber = useJobRunsApi((state) => state.pagination?.page_number);
  const isEnabled = !disabled && pageNumber === 1;

  // User can schedule a one-off job or a recurring job at a granularity of minutes.
  // Therefore, refreshing per minute is enough unless there is an ongoing run,
  // as its status can update at any second. In this case we update every 5 seconds.
  const getNextRefresh = React.useCallback(
    () => (hasOngoingRuns ? Date.now() + 5000 : nextMinute()),
    [hasOngoingRuns]
  );

  React.useEffect(() => {
    if (!isEnabled) return;

    let handle = -1;

    const handler = () => {
      const duration = getNextRefresh() - Date.now();

      handle = window.setTimeout(() => {
        refresh();
        handler();
      }, duration);
    };

    handler();

    return () => window.clearInterval(handle);
  }, [getNextRefresh, refresh, isEnabled, pageNumber]);
};
