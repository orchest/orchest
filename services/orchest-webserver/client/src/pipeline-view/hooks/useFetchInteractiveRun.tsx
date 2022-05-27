import { useFetcher } from "@/hooks/useFetcher";
import { PipelineRun } from "@/types";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { PIPELINE_RUN_STATUS_ENDPOINT } from "../common";

export const useFetchInteractiveRun = (
  projectUuid: string | undefined,
  pipelineUuid: string | undefined,
  runUuidFromRoute: string | undefined
) => {
  // Edit mode fetches latest interactive run
  const shouldFetchRunUuid =
    !runUuidFromRoute && hasValue(projectUuid) && hasValue(pipelineUuid);

  const { data, error: fetchRunUuidError, status } = useFetcher<{
    runs: PipelineRun[];
  }>(
    shouldFetchRunUuid
      ? `${PIPELINE_RUN_STATUS_ENDPOINT}/?project_uuid=${projectUuid}&pipeline_uuid=${pipelineUuid}`
      : undefined
  );

  const [runUuid, setRunUuid] = React.useState<string | undefined>(
    !shouldFetchRunUuid ? runUuidFromRoute : undefined
  );

  React.useEffect(() => {
    if (!runUuid && data) {
      setRunUuid(data.runs[0]?.uuid || runUuidFromRoute);
    }
  }, [runUuid, data, runUuidFromRoute]);

  return {
    runUuid,
    setRunUuid,
    fetchRunUuidError,
    isFetchingRunUuid: status === "PENDING",
  };
};
