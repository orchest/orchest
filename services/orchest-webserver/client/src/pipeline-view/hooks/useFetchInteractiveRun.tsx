import { PipelineRun } from "@/types";
import { fetcher, hasValue } from "@orchest/lib-utils";
import React from "react";
import useSWR, { MutatorCallback } from "swr";
import { PIPELINE_RUN_STATUS_ENDPOINT } from "../common";

export const useFetchInteractiveRun = (
  projectUuid: string | undefined,
  pipelineUuid: string | undefined,
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
  } = useSWR<string | undefined>(
    shouldFetchRunUuid
      ? `${PIPELINE_RUN_STATUS_ENDPOINT}/?project_uuid=${projectUuid}&pipeline_uuid=${pipelineUuid}`
      : null,
    (url) =>
      fetcher<{ runs: PipelineRun[] }>(url).then((result) => {
        return result.runs.length > 0 ? result.runs[0].uuid : undefined;
      })
  );

  const runUuid = shouldFetchRunUuid ? fetchedRunUuid : runUuidFromRoute;

  const setRunUuid = React.useCallback(
    (
      data?:
        | string
        | undefined
        | Promise<string | undefined>
        | MutatorCallback<string | undefined>
    ) => mutateRunUuid(data, false),
    [mutateRunUuid]
  );

  return { runUuid, setRunUuid, fetchRunUuidError, isFetchingRunUuid };
};
