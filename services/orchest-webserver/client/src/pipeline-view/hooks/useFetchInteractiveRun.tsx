import { PipelineRun } from "@/types";
import { fetcher, hasValue } from "@orchest/lib-utils";
import React from "react";
import useSWR, { MutatorCallback } from "swr";
import { PIPELINE_RUN_STATUS_ENDPOINT } from "../common";

export const useFetchInteractiveRun = (
  projectUuid: string,
  pipelineUuid: string,
  runUuidFromRoute: string | undefined
) => {
  // Edit mode fetches latest interactive run
  const shouldFetchRunUuid =
    !runUuidFromRoute && hasValue(projectUuid) && hasValue(pipelineUuid);

  const {
    data: fetchedRunUuid,
    mutate: mutateRunUuid,
    error: fetchRunUuidError,
    isValidating: isFetchingRunUuid,
  } = useSWR(
    shouldFetchRunUuid
      ? `${PIPELINE_RUN_STATUS_ENDPOINT}/?project_uuid=${projectUuid}&pipeline_uuid=${pipelineUuid}`
      : null,
    (url) =>
      fetcher<{ runs: PipelineRun[] }>(url).then((result) => {
        return result.runs.length > 0 ? result.runs[0].uuid : null;
      })
  );

  const runUuid = shouldFetchRunUuid ? fetchedRunUuid : runUuidFromRoute;

  const setRunUuid = React.useCallback(
    (data?: string | Promise<string> | MutatorCallback<string>) =>
      mutateRunUuid(data, false),
    [mutateRunUuid]
  );

  return { runUuid, setRunUuid, fetchRunUuidError, isFetchingRunUuid };
};
