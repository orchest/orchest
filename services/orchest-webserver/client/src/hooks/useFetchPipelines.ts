import type { PipelineMetaData } from "@/types";
import { fetcher, hasValue } from "@orchest/lib-utils";
import React from "react";
import { useAsync } from "./useAsync";
import { useFocusBrowserTab } from "./useFocusBrowserTab";
import { useHasChanged } from "./useHasChanged";

export const fetchPipelines = (projectUuid: string) =>
  fetcher<{ result: PipelineMetaData[] }>(
    `/async/pipelines/${projectUuid}`
  ).then((response) => response.result);

export const useFetchPipelines = (
  projectUuid: string | undefined,
  revalidateOnFocus = true
) => {
  const { run, data, setData, status, error } = useAsync<PipelineMetaData[]>();

  const makeRequest = React.useCallback(
    (projectUuid?: string) => {
      return hasValue(projectUuid)
        ? run(fetchPipelines(projectUuid))
        : Promise.reject();
    },
    [run]
  );

  const isFocused = useFocusBrowserTab();
  const hasBrowserFocusChanged = useHasChanged(isFocused);
  const shouldRefetch =
    revalidateOnFocus && hasBrowserFocusChanged && isFocused;

  const hasFetchedProjectUuid = React.useRef<string>();

  React.useEffect(() => {
    if (
      hasValue(projectUuid) &&
      (hasFetchedProjectUuid.current !== projectUuid || shouldRefetch)
    ) {
      hasFetchedProjectUuid.current = projectUuid;
      makeRequest(projectUuid);
    }
  }, [shouldRefetch, makeRequest, projectUuid]);

  return {
    pipelines: data,
    error,
    isFetchingPipelines: status === "PENDING",
    fetchPipelines: makeRequest,
    setPipelines: setData,
    status,
  };
};
