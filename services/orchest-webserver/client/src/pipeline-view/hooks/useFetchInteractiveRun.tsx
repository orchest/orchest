import { pipelineRunsApi } from "@/api/pipeline-runs/pipelineRunsApi";
import { useAsync } from "@/hooks/useAsync";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { PipelineRun } from "@/types";
import { hasValue } from "@orchest/lib-utils";
import React from "react";

export const useFetchInteractiveRun = () => {
  const { projectUuid, pipelineUuid, runUuid: routeRunUuid } = useCustomRoute();
  const { run, status, data: fetchedRuns } = useAsync<PipelineRun[]>();

  // Edit mode fetches latest interactive run
  const shouldFetchRunUuid =
    !routeRunUuid && hasValue(projectUuid) && hasValue(pipelineUuid);

  if (shouldFetchRunUuid && !hasValue(fetchedRuns) && status === "IDLE") {
    run(pipelineRunsApi.fetchAll(projectUuid, pipelineUuid));
  }

  const [runUuid, setRunUuid] = React.useState(
    !shouldFetchRunUuid ? routeRunUuid : undefined
  );

  React.useEffect(() => {
    if (!routeRunUuid && fetchedRuns?.length) setRunUuid(fetchedRuns[0].uuid);
  }, [routeRunUuid, fetchedRuns]);

  return { runUuid, setRunUuid };
};
