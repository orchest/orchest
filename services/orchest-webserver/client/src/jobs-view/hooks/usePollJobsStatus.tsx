import { useProjectJobsApi } from "@/api/jobs/useProjectJobsApi";
import { useAsync } from "@/hooks/useAsync";
import { useInterval } from "@/hooks/useInterval";
import { hasValue } from "@orchest/lib-utils";
import React from "react";

/** Keeps job statuses updated in the jobs store by polling the back-end. */
export const usePollJobsStatus = () => {
  const isFetchingRef = React.useRef(false);
  const isStoreLoaded = useProjectJobsApi((state) => hasValue(state.jobs));
  const updateStatus = useProjectJobsApi((state) => state.updateStatus);
  const { run, error, status } = useAsync();

  isFetchingRef.current = status === "PENDING";

  const poll = React.useCallback(() => {
    if (!isFetchingRef.current) {
      run(updateStatus());
    }
  }, [run, updateStatus]);

  React.useEffect(() => error && console.log(error), [error]);

  useInterval(poll, !isStoreLoaded ? undefined : 1000);
};
